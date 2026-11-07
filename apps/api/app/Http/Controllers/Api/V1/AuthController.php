<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\IdentityAccess\Actions\MfaService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly MfaService $mfa) {}

    public function login(LoginRequest $request): JsonResponse
    {
        if (! Auth::attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        /** @var User $user */
        $user = $request->user();

        if ($user->mfa_enabled) {
            Auth::guard('web')->logout();
            $challenge = $this->mfa->issueChallengeToken($user);

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

        $user = $this->mfa->userFromChallengeToken($data['challenge_token']);
        if (! $user || ! $this->mfa->verify($user, $data['code'])) {
            throw ValidationException::withMessages([
                'code' => ['Invalid authentication code.'],
            ]);
        }

        Auth::login($user, true);
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
        if (! $this->mfa->confirmSetup($request->user(), $data['code'])) {
            throw ValidationException::withMessages(['code' => ['Invalid code.']]);
        }

        return response()->json(['data' => new UserResource($request->user()->fresh())]);
    }

    public function logout(Request $request): JsonResponse
    {
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
