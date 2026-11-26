<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\IdentityAccess\Actions\SsoLogin;
use App\Domains\IdentityAccess\Actions\SyncActiveOrgAfterSignIn;
use App\Domains\IdentityAccess\Support\SignInEligibility;
use App\Domains\IdentityAccess\Support\SsoError;
use App\Domains\IdentityAccess\Support\SsoFlowStore;
use App\Domains\IdentityAccess\Support\SsoIdTokenValidator;
use App\Domains\IdentityAccess\Support\SsoLoginException;
use App\Domains\IdentityAccess\Support\SsoProvider;
use App\Domains\IdentityAccess\Support\SsoReturnOrigin;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use RuntimeException;
use Throwable;

/**
 * Google and Microsoft sign-in. The callback runs on the fixed API host and finishes by handing a one-time token to
 * the tenant host, where the Sanctum session cookie is created (see docs/auth.md).
 */
class SsoController extends Controller
{
    public function __construct(
        private readonly SsoFlowStore $flows,
        private readonly SsoReturnOrigin $returnOrigins,
        private readonly SsoIdTokenValidator $idTokens,
        private readonly SsoLogin $ssoLogin,
        private readonly SignInEligibility $eligibility,
        private readonly SyncActiveOrgAfterSignIn $activeOrg,
    ) {}

    /**
     * Providers that have a client id configured. The login page shows buttons only for these. No secrets are returned.
     */
    public function providers(): JsonResponse
    {
        $configured = [];
        foreach (SsoProvider::cases() as $ssoProvider) {
            if ($ssoProvider->isConfigured()) {
                $configured[] = $ssoProvider->value;
            }
        }

        return response()->json(['data' => $configured]);
    }

    public function redirect(Request $request, string $provider): RedirectResponse
    {
        $ssoProvider = SsoProvider::from($provider);

        $data = $request->validate([
            'return_to' => ['required', 'string', 'max:255'],
            'next' => ['nullable', 'string', 'max:500'],
        ]);

        $origin = $this->returnOrigins->normalize($data['return_to']);
        if ($origin === null) {
            return $this->redirectToLogin(null, SsoError::InvalidRequest);
        }

        if (! $ssoProvider->isConfigured()) {
            return $this->redirectToLogin($origin, SsoError::ProviderNotConfigured);
        }

        $state = Str::random(40);
        $nonce = Str::random(40);

        $this->flows->putState($state, [
            'provider' => $ssoProvider->value,
            'nonce' => $nonce,
            'origin' => $origin,
            'next' => $this->safeNext($data['next'] ?? null),
            'remember' => $request->boolean('remember'),
        ]);

        // Socialite must not store its own state in the session. Our cache-backed state is passed instead.
        return $this->oauthDriver($ssoProvider)
            ->setScopes($ssoProvider->scopes())
            ->with(['state' => $state, 'nonce' => $nonce])
            ->redirect();
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $ssoProvider = SsoProvider::from($provider);

        $flow = $this->flows->pullState((string) $request->query('state', ''));
        if ($flow === null || $flow['provider'] !== $ssoProvider->value) {
            return $this->redirectToLogin(null, SsoError::InvalidState);
        }

        $providerError = $request->query('error');
        if (is_string($providerError) && $providerError !== '') {
            $error = $providerError === 'access_denied' ? SsoError::Cancelled : SsoError::ProviderError;

            return $this->redirectToLogin($flow['origin'], $error);
        }

        try {
            $user = $this->signInFromCallback($request, $ssoProvider, $flow);
        } catch (SsoLoginException $exception) {
            return $this->redirectToLogin($flow['origin'], $exception->error);
        } catch (Throwable $exception) {
            report($exception);

            return $this->redirectToLogin($flow['origin'], SsoError::ProviderError);
        }

        $token = $this->flows->putHandoff([
            'user_id' => $user->id,
            'next' => $flow['next'],
            'remember' => $flow['remember'],
        ]);

        return redirect()->away($flow['origin'].'/login/sso/complete?'.http_build_query(['token' => $token]));
    }

    /**
     * Second half of the sign-in, called from the tenant host. Consumes the one-time token and creates the session
     * on this host. SSO skips the app's own MFA: the identity provider already performed its strong authentication.
     */
    public function exchange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
        ]);

        $handoff = $this->flows->pullHandoff($data['token']);
        $user = $handoff === null ? null : User::query()->find($handoff['user_id']);

        if ($user === null) {
            throw ValidationException::withMessages([
                'token' => [__('auth.sso_handoff_invalid')],
            ]);
        }

        if ($this->eligibility->blockReason($user, viaPassword: false) !== null) {
            throw ValidationException::withMessages([
                'token' => [__('auth.disabled')],
            ]);
        }

        Auth::guard('web')->login($user, $handoff['remember']);

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $this->activeOrg->handle($user);

        return response()->json([
            'data' => new UserResource($user),
            'next' => $handoff['next'],
        ]);
    }

    /**
     * @param  array{provider: string, nonce: string, origin: string, next: ?string, remember: bool}  $flow
     *
     * @throws SsoLoginException
     */
    private function signInFromCallback(Request $request, SsoProvider $provider, array $flow): User
    {
        $code = $request->query('code');
        if (! is_string($code) || $code === '') {
            throw new SsoLoginException(SsoError::ProviderError, 'Callback has no authorization code.');
        }

        $driver = $this->oauthDriver($provider);
        $tokenResponse = $driver->getAccessTokenResponse($code);

        $accessToken = is_array($tokenResponse) ? Arr::get($tokenResponse, 'access_token') : null;
        $idToken = is_array($tokenResponse) ? Arr::get($tokenResponse, 'id_token') : null;
        if (! is_string($accessToken) || $accessToken === '' || ! is_string($idToken) || $idToken === '') {
            throw new SsoLoginException(SsoError::ProviderError, 'Token response lacks access_token or id_token.');
        }

        $claims = $this->idTokens->validate(
            $idToken,
            $provider,
            (string) config('services.'.$provider->driverName().'.client_id'),
            $flow['nonce'],
        );

        return $this->ssoLogin->handle($provider, $driver->userFromToken($accessToken), $claims);
    }

    /**
     * Socialite's Provider contract does not declare stateless(), and the code exchange needs the OAuth2 driver.
     * Both providers are OAuth2, so the narrowing below always holds for configured drivers.
     */
    private function oauthDriver(SsoProvider $provider): AbstractProvider
    {
        $driver = Socialite::driver($provider->driverName());
        if (! $driver instanceof AbstractProvider) {
            throw new RuntimeException('Socialite driver ['.$provider->driverName().'] is not an OAuth2 provider.');
        }

        return $driver->stateless();
    }

    private function redirectToLogin(?string $origin, SsoError $error): RedirectResponse
    {
        $base = $origin ?? rtrim((string) config('brand.frontend_url'), '/');

        return redirect()->away($base.'/login?'.http_build_query(['sso_error' => $error->value]));
    }

    private function safeNext(?string $next): ?string
    {
        if ($next === null || ! str_starts_with($next, '/') || str_starts_with($next, '//') || str_contains($next, '\\')) {
            return null;
        }

        return $next;
    }
}
