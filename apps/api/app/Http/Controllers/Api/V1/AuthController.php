<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\IdentityAccess\Actions\ListSignInOrganizations;
use App\Domains\IdentityAccess\Actions\MfaService;
use App\Domains\IdentityAccess\Actions\PasskeyService;
use App\Domains\IdentityAccess\Actions\SyncActiveOrgAfterSignIn;
use App\Domains\IdentityAccess\Notifications\EmployeeInviteNotification;
use App\Domains\IdentityAccess\Support\OrgChoiceChallenge;
use App\Domains\IdentityAccess\Support\SignInBlockReason;
use App\Domains\IdentityAccess\Support\SignInEligibility;
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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly MfaService $mfa,
        private readonly PasskeyService $passkeys,
        private readonly SignInEligibility $eligibility,
        private readonly SyncActiveOrgAfterSignIn $activeOrg,
        private readonly ListSignInOrganizations $organizations,
        private readonly OrgChoiceChallenge $orgChoice,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $logins = $this->passwordLogins(
            (string) $request->input('email'),
            (string) $request->input('password'),
            $request->input('tenant'),
        );

        if ($logins->isEmpty()) {
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        $remember = $request->boolean('remember');
        $organizationHint = $this->organizationHint($request);

        if ($logins->count() === 1) {
            return $this->signIn($request, $logins->first(), $remember, $organizationHint);
        }

        return $this->chooseOrganization($request, $logins, $remember, $organizationHint);
    }

    /**
     * Second step after a password matched several organizations: the user picked one, so no password is asked again.
     */
    public function loginOrg(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
            'tenant' => ['required', 'string', 'max:64'],
        ]);

        $challenge = $this->orgChoice->fromToken($data['challenge_token']);
        if ($challenge === null) {
            throw ValidationException::withMessages([
                'challenge_token' => [__('auth.org_choice_invalid')],
            ]);
        }

        $login = $challenge['logins']->first(
            fn (User $candidate): bool => $candidate->tenant_id === $data['tenant'],
        );
        if (! $login instanceof User) {
            throw ValidationException::withMessages([
                'tenant' => [__('auth.org_choice_invalid')],
            ]);
        }

        $this->orgChoice->consume($data['challenge_token']);

        return $this->signIn($request, $login, $challenge['remember'], $data['tenant']);
    }

    /**
     * Switch from this login to another organization login that shares the same email.
     * That login has its own password (and MFA), so both are required here.
     */
    public function switchOrg(Request $request, string $tenant): JsonResponse
    {
        if (! $request->hasSession()) {
            abort(400, 'A browser session is required to switch organizations.');
        }

        /** @var User $current */
        $current = $request->user();
        if ($current->isPlatformStaff()) {
            abort(403, 'Platform staff must enter tenants via MSP.');
        }

        $data = $request->validate([
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $login = User::query()
            ->withEmail((string) $current->email)
            ->where('tenant_id', $tenant)
            ->whereKeyNot($current->getKey())
            ->first();

        if (! $login instanceof User || ! $this->organizations->isUsableOrganizationLogin($login)) {
            abort(403, 'You do not have a login for this organization.');
        }

        if (! Hash::check($data['password'], $login->getAuthPassword())) {
            throw ValidationException::withMessages([
                'password' => [__('auth.password')],
            ]);
        }

        return $this->signIn($request, $login, $request->boolean('remember'), $tenant);
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

        return $this->completeMfaLogin(
            $request,
            $data['challenge_token'],
            $user,
            $challenge['remember'],
            $challenge['preferred_tenant_id'],
        );
    }

    public function passkeyMfaOptions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
        ]);

        $challenge = $this->mfa->challengeFromToken($data['challenge_token']);
        if ($challenge === null) {
            throw ValidationException::withMessages([
                'code' => [__('auth.mfa_challenge_invalid')],
            ]);
        }

        if (! $challenge['user']->webauthnCredentials()->exists()) {
            throw ValidationException::withMessages([
                'credential' => [__('auth.passkey_not_found')],
            ]);
        }

        return response()->json($this->passkeys->beginAssertion($challenge['user']));
    }

    public function verifyPasskeyMfa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
            'credential' => ['required', 'array'],
        ]);

        $challenge = $this->mfa->challengeFromToken($data['challenge_token']);
        if ($challenge === null) {
            throw ValidationException::withMessages([
                'code' => [__('auth.mfa_challenge_invalid')],
            ]);
        }

        $user = $challenge['user'];
        if (! $this->passkeys->verifyAssertion($user, $data['credential'])) {
            throw ValidationException::withMessages([
                'credential' => [__('auth.passkey_invalid')],
            ]);
        }

        return $this->completeMfaLogin(
            $request,
            $data['challenge_token'],
            $user,
            $challenge['remember'],
            $challenge['preferred_tenant_id'],
        );
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
            'code' => ['required_without:passkey', 'nullable', 'string'],
            'passkey' => ['required_without:code', 'nullable', 'array'],
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

        if (isset($data['passkey'])) {
            $ok = $this->passkeys->verifyAssertion($user, $data['passkey']);
            if (! $ok) {
                throw ValidationException::withMessages([
                    'credential' => [__('auth.passkey_invalid')],
                ]);
            }
        } else {
            $ok = $this->mfa->verify($user, (string) $data['code'])
                || $this->mfa->verifyRecoveryCode($user, (string) $data['code']);
            if (! $ok) {
                throw ValidationException::withMessages([
                    'code' => [__('auth.mfa_code_invalid')],
                ]);
            }
        }

        $this->mfa->disable($user);

        return response()->json(['data' => new UserResource($user->fresh())]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'tenant' => ['nullable', 'string', 'max:64'],
        ]);

        // Every organization login with this email gets its own reset link.
        foreach ($this->accountsForEmail($data['email'], $data['tenant'] ?? null) as $account) {
            try {
                Password::broker()->sendResetLink([
                    'email' => $account->email,
                    'tenant_id' => $account->tenant_id,
                ]);
            } catch (\Throwable $e) {
                // Never leak mail-transport failures (or reveal whether the account exists).
                report($e);
            }
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
            'tenant' => ['nullable', 'string', 'max:64'],
        ]);

        $tenantId = $this->resetTenantId($data['email'], $data['tenant'] ?? null);

        $status = Password::broker($this->resetPasswordBrokerName($data['email'], $data['token'], $tenantId))->reset(
            [
                'email' => $data['email'],
                'tenant_id' => $tenantId,
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

    /**
     * Employee invites and regular reset links keep their tokens in separate tables;
     * use the broker whose table holds this token.
     */
    private function resetPasswordBrokerName(string $email, string $token, ?string $tenantId): string
    {
        $user = User::query()->withEmail($email)->where('tenant_id', $tenantId)->first();

        if ($user !== null && Password::broker(EmployeeInviteNotification::PASSWORD_BROKER)->tokenExists($user, $token)) {
            return EmployeeInviteNotification::PASSWORD_BROKER;
        }

        return config('auth.defaults.passwords');
    }

    /**
     * Reset links carry the organization. Without it, an email that has one organization login
     * resolves to that login; anything ambiguous falls back to platform staff (tenant null).
     */
    private function resetTenantId(string $email, ?string $tenant): ?string
    {
        if ($tenant !== null && $tenant !== '') {
            return $tenant;
        }

        $accounts = $this->accountsForEmail($email, null);

        return $accounts->count() === 1 ? $accounts->first()->tenant_id : null;
    }

    /**
     * @return Collection<int, User>
     */
    private function accountsForEmail(string $email, ?string $tenant): Collection
    {
        return User::query()
            ->withEmail($email)
            ->when($tenant !== null && $tenant !== '', fn (Builder $query) => $query->where('tenant_id', $tenant))
            ->get();
    }

    /**
     * Logins whose password matches the email and password. The optional tenant (the organization
     * sign-in address) narrows the search to that organization's login.
     *
     * @return Collection<int, User>
     */
    private function passwordLogins(string $email, string $password, mixed $tenant): Collection
    {
        $query = User::query()->withEmail($email)->with('tenant');
        if (is_string($tenant) && $tenant !== '') {
            $query->where('tenant_id', $tenant);
        }

        return $query->get()
            ->filter(fn (User $user): bool => Hash::check($password, $user->getAuthPassword()))
            ->values();
    }

    /**
     * The organization sign-in address (subdomain or ?tenant=) sent with the password. When this login can enter
     * that organization, it becomes the active one, so the user is not asked to pick it again.
     */
    private function organizationHint(Request $request): ?string
    {
        $tenant = $request->input('tenant');

        return is_string($tenant) && $tenant !== '' ? $tenant : null;
    }

    /**
     * One password matched several organization logins: the user picks the organization next. Platform
     * staff logins are never listed, and logins that cannot be used are dropped.
     *
     * @param  Collection<int, User>  $logins
     */
    private function chooseOrganization(
        Request $request,
        Collection $logins,
        bool $remember,
        ?string $organizationHint,
    ): JsonResponse {
        $organizationLogins = $logins
            ->filter(fn (User $login): bool => $this->organizations->isUsableOrganizationLogin($login))
            ->values();

        if ($organizationLogins->isEmpty()) {
            /** @var User $first */
            $first = $logins->first();

            return $this->signIn($request, $first, $remember);
        }

        if ($organizationLogins->count() === 1) {
            return $this->signIn($request, $organizationLogins->first(), $remember, $organizationHint);
        }

        return response()->json([
            'org_choice_required' => true,
            'challenge_token' => $this->orgChoice->issue($organizationLogins, $remember),
            'organizations' => $organizationLogins
                ->map(fn (User $login): array => [
                    'tenant_id' => (string) $login->tenant_id,
                    'name' => $login->tenant->name ?? (string) $login->tenant_id,
                ])
                ->values()
                ->all(),
        ]);
    }

    /**
     * Checks account state and MFA, then starts the session. $preferredTenantId is an organization the user
     * picked explicitly; it becomes the active organization once the session starts.
     */
    private function signIn(Request $request, User $user, bool $remember, ?string $preferredTenantId = null): JsonResponse
    {
        $blockReason = $this->eligibility->blockReason($user, viaPassword: true);
        if ($blockReason !== null) {
            throw ValidationException::withMessages([
                'email' => [$this->signInBlockMessage($blockReason)],
            ]);
        }

        if ($user->mfa_enabled) {
            return response()->json([
                'mfa_required' => true,
                'challenge_token' => $this->mfa->issueChallengeToken($user, $remember, $preferredTenantId),
                'mfa_methods' => $this->mfaMethods($user),
            ]);
        }

        $this->startSession($request, $user, $remember, $preferredTenantId);

        return response()->json([
            'data' => new UserResource($user),
            'mfa_required' => false,
        ]);
    }

    private function startSession(Request $request, User $user, bool $remember, ?string $preferredTenantId): void
    {
        Auth::guard('web')->login($user, $remember);

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $this->activeOrg->handle($user, $preferredTenantId);
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

    /**
     * @return array{totp: bool, passkey: bool}
     */
    private function mfaMethods(User $user): array
    {
        return [
            'totp' => is_string($user->mfa_secret) && $user->mfa_secret !== '',
            'passkey' => $user->webauthnCredentials()->exists(),
        ];
    }

    private function completeMfaLogin(
        Request $request,
        string $challengeToken,
        User $user,
        bool $remember,
        ?string $preferredTenantId,
    ): JsonResponse {
        $this->mfa->consumeChallengeToken($challengeToken);
        $this->startSession($request, $user, $remember, $preferredTenantId);

        return response()->json(['data' => new UserResource($user)]);
    }

    private function signInBlockMessage(SignInBlockReason $reason): string
    {
        return match ($reason) {
            SignInBlockReason::Disabled => __('auth.disabled'),
            SignInBlockReason::PasswordSetupRequired => __('auth.must_set_password'),
            SignInBlockReason::EmailUnverified => __('auth.email_unverified'),
        };
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
