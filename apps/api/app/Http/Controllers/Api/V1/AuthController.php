<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\IdentityAccess\Actions\MfaService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Support\StaffTenant;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly MfaService $mfa) {}

    public function login(LoginRequest $request): JsonResponse
    {
        if (! Auth::guard('web')->attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        /** @var User $user */
        $user = $request->user();

        if ($user->disabled_at !== null) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => ['This account has been disabled.'],
            ]);
        }

        if ($user->must_set_password) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => ['Please use the invite link in your email to set a password before signing in.'],
            ]);
        }

        if ($user->email_verified_at === null) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => ['This account email address is not verified.'],
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
                'code' => ['Invalid or expired authentication challenge. Sign in again.'],
            ]);
        }

        $user = $challenge['user'];
        $code = $data['code'];
        $ok = $this->mfa->verify($user, $code) || $this->mfa->verifyRecoveryCode($user, $code);
        if (! $ok) {
            throw ValidationException::withMessages([
                'code' => ['Invalid authentication code.'],
            ]);
        }

        $this->mfa->consumeChallengeToken($data['challenge_token']);
        Auth::login($user, $challenge['remember']);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json(['data' => new UserResource($user)]);
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
            throw ValidationException::withMessages(['code' => ['Invalid code.']]);
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
                'password' => ['The provided password is incorrect.'],
            ]);
        }

        if (! $user->mfa_enabled) {
            throw ValidationException::withMessages([
                'code' => ['Multi-factor authentication is not enabled.'],
            ]);
        }

        $ok = $this->mfa->verify($user, $data['code'])
            || $this->mfa->verifyRecoveryCode($user, $data['code']);
        if (! $ok) {
            throw ValidationException::withMessages([
                'code' => ['Invalid authentication code.'],
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
            'message' => 'If that email is registered, a reset link has been sent.',
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
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                    'must_set_password' => false,
                    'disabled_at' => null,
                ])->save();

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json(['message' => 'Password has been reset.']);
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
                'current_password' => ['The provided password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'password' => $data['password'],
            'remember_token' => Str::random(60),
            'must_set_password' => false,
        ])->save();

        StaffTenant::clear();

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json(['message' => 'Password updated.']);
    }

    public function logout(Request $request): JsonResponse
    {
        StaffTenant::clear();
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): UserResource|JsonResponse
    {
        $user = $request->user() ?? Auth::guard('web')->user();
        if ($user === null) {
            return response()->json(['data' => null]);
        }

        return new UserResource($user);
    }
}
