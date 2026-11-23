<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\IdentityAccess\Actions\MfaService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Resources\Api\V1\TenantResource;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\Tenant;
use App\Models\User;
use App\Support\ActiveOrgTenant;
use App\Support\AppLocale;
use App\Support\StaffTenant;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly MfaService $mfa) {}

    public function login(LoginRequest $request): JsonResponse
    {
        if (! Auth::guard('web')->attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        /** @var User $user */
        $user = $request->user();

        if ($user->disabled_at !== null) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => [__('auth.disabled')],
            ]);
        }

        if ($user->must_set_password) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => [__('auth.must_set_password')],
            ]);
        }

        if ($user->email_verified_at === null) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => [__('auth.email_unverified')],
            ]);
        }

        if ($user->mfa_enabled) {
            $remember = $request->boolean('remember');
            Auth::guard('web')->logout();
            $challenge = $this->mfa->issueChallengeToken($user, $remember);

            return response()->json([
                'mfa_required' => true,
                'challenge_token' => $challenge,
            ]);
        }

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $this->syncActiveOrgAfterAuth($user);

        return response()->json([
            'data' => new UserResource($user),
            'mfa_required' => false,
        ]);
    }

    public function verifyMfa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        $challenge = $this->mfa->challengeFromToken($data['challenge_token']);
        if ($challenge === null) {
            throw ValidationException::withMessages([
                'code' => [__('auth.mfa_challenge_invalid')],
            ]);
        }

        $user = $challenge['user'];
        $code = $data['code'];
        $ok = $this->mfa->verify($user, $code) || $this->mfa->verifyRecoveryCode($user, $code);
        if (! $ok) {
            throw ValidationException::withMessages([
                'code' => [__('auth.mfa_code_invalid')],
            ]);
        }

        $this->mfa->consumeChallengeToken($data['challenge_token']);
        Auth::login($user, $challenge['remember']);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $this->syncActiveOrgAfterAuth($user);

        return response()->json(['data' => new UserResource($user)]);
    }

    public function enterOrg(Request $request, string $tenant): JsonResponse
    {
        if (! $request->hasSession()) {
            abort(400, 'A browser session is required to enter an organization.');
        }

        /** @var User $user */
        $user = $request->user();
        if ($user->isPlatformStaff()) {
            abort(403, 'Platform staff must enter tenants via MSP.');
        }

        if (! $user->belongsToTenant($tenant)) {
            abort(403, 'You do not belong to this organization.');
        }

        $model = Tenant::query()->findOrFail($tenant);
        ActiveOrgTenant::set($model->id);

        if ($user->tenant_id !== $model->id) {
            $membership = $user->membershipFor($model->id);
            $user->forceFill([
                'tenant_id' => $model->id,
                'department_id' => $membership?->department_id,
                'department' => $membership?->department,
            ])->save();
        }

        return response()->json([
            'data' => (new UserResource($user->fresh(['memberships.tenant', 'roles'])))->resolve(),
            'tenant' => (new TenantResource($model->load('domains')))->resolve(),
        ]);
    }

    public function leaveOrg(Request $request): JsonResponse
    {
        if (! $request->hasSession()) {
            abort(400, 'A browser session is required to leave an organization.');
        }

        ActiveOrgTenant::clear();

        return response()->json([
            'data' => (new UserResource($request->user()))->resolve(),
        ]);
    }

    public function setupMfa(Request $request): JsonResponse
    {
        return response()->json($this->mfa->beginSetup($request->user()));
    }

    public function confirmMfa(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $codes = $this->mfa->confirmSetup($request->user(), $data['code']);
        if ($codes === null) {
            throw ValidationException::withMessages(['code' => [__('auth.mfa_setup_code_invalid')]]);
        }

        return response()->json([
            'data' => new UserResource($request->user()->fresh()),
            'recovery_codes' => $codes,
        ]);
    }

    public function disableMfa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        /** @var User $user */
        $user = $request->user();
        if (! Hash::check($data['password'], $user->getAuthPassword())) {
            throw ValidationException::withMessages([
                'password' => [__('auth.password')],
            ]);
        }

        if (! $user->mfa_enabled) {
            throw ValidationException::withMessages([
                'code' => [__('auth.mfa_not_enabled')],
            ]);
        }

        $ok = $this->mfa->verify($user, $data['code'])
            || $this->mfa->verifyRecoveryCode($user, $data['code']);
        if (! $ok) {
            throw ValidationException::withMessages([
                'code' => [__('auth.mfa_code_invalid')],
            ]);
        }

        $this->mfa->disable($user);

        return response()->json(['data' => new UserResource($user->fresh())]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        try {
            Password::broker()->sendResetLink(['email' => $data['email']]);
        } catch (\Throwable $e) {
            // Never leak mail-transport failures (or reveal whether the account exists).
            report($e);
        }

        return response()->json([
            'message' => __('auth.forgot_password_sent'),
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::broker()->reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $request->input('password_confirmation'),
                'token' => $data['token'],
            ],
            function (User $user, string $password): void {
                if ($user->disabled_at !== null) {
                    throw ValidationException::withMessages([
                        'email' => [__('auth.password_reset_disabled')],
                    ]);
                }

                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                    'must_set_password' => false,
                ])->save();

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json(['message' => __('auth.password_reset')]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        /** @var User $user */
        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->getAuthPassword())) {
            throw ValidationException::withMessages([
                'current_password' => [__('auth.password')],
            ]);
        }

        $user->forceFill([
            'password' => $data['password'],
            'remember_token' => Str::random(60),
            'must_set_password' => false,
        ])->save();

        StaffTenant::clear();
        ActiveOrgTenant::clear();

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json(['message' => __('auth.password_updated')]);
    }

    public function logout(Request $request): JsonResponse
    {
        StaffTenant::clear();
        ActiveOrgTenant::clear();
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => __('auth.logged_out')]);
    }

    private function syncActiveOrgAfterAuth(User $user): void
    {
        if ($user->isPlatformStaff()) {
            ActiveOrgTenant::clear();

            return;
        }

        $user->loadMissing('memberships');
        $active = $user->memberships->filter(fn ($m): bool => $m->isActive())->values();

        if ($active->count() === 1) {
            ActiveOrgTenant::set($active->first()->tenant_id);

            return;
        }

        $current = ActiveOrgTenant::id();
        if (is_string($current) && $current !== '' && $user->belongsToTenant($current)) {
            return;
        }

        ActiveOrgTenant::clear();
    }

    public function me(Request $request): UserResource|JsonResponse
    {
        $user = $request->user() ?? Auth::guard('web')->user();
        if ($user === null) {
            return response()->json(['data' => null]);
        }

        return new UserResource($user);
    }

    public function updateLocale(Request $request): UserResource
    {
        $data = $request->validate([
            'locale' => ['required', 'string', Rule::in(AppLocale::ALLOWED)],
        ]);

        /** @var User $user */
        $user = $request->user();
        $user->forceFill([
            'locale' => AppLocale::normalize($data['locale']),
        ])->save();

        return new UserResource($user->fresh());
    }
}
