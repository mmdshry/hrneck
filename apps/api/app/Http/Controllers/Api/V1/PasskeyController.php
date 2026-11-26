<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\IdentityAccess\Actions\MfaService;
use App\Domains\IdentityAccess\Actions\PasskeyService;
use App\Domains\IdentityAccess\Models\WebauthnCredential;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Manages the signed-in user's passkeys. Second-factor sign-in lives in AuthController.
 */
class PasskeyController extends Controller
{
    public function __construct(
        private readonly PasskeyService $passkeys,
        private readonly MfaService $mfa,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $credentials = $this->passkeys->credentialsFor($this->user($request));

        return response()->json([
            'data' => $credentials->map(fn (WebauthnCredential $credential): array => $this->present($credential))->values(),
        ]);
    }

    public function registerOptions(Request $request): JsonResponse
    {
        return response()->json($this->passkeys->beginRegistration($this->user($request)));
    }

    public function registerVerify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'credential' => ['required', 'array'],
            'name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $this->user($request);
        $name = trim((string) ($data['name'] ?? ''));

        $credential = $this->passkeys->finishRegistration(
            $user,
            $data['credential'],
            $name !== '' ? $name : __('auth.passkey_default_name'),
        );

        // Adding a factor activates MFA and, if none exist yet, issues recovery codes.
        $recoveryCodes = $this->mfa->reconcileFactors($user);

        return response()->json([
            'data' => new UserResource($user->fresh()),
            'passkey' => $this->present($credential),
            'recovery_codes' => $recoveryCodes ?? [],
        ]);
    }

    /**
     * Step-up options used to confirm a passkey before disabling MFA.
     */
    public function assertionOptions(Request $request): JsonResponse
    {
        $user = $this->user($request);
        if (! $user->webauthnCredentials()->exists()) {
            throw ValidationException::withMessages([
                'credential' => [__('auth.passkey_not_found')],
            ]);
        }

        return response()->json($this->passkeys->beginAssertion($user));
    }

    public function destroy(Request $request, int $passkey): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $this->user($request);
        if (! Hash::check($data['password'], $user->getAuthPassword())) {
            throw ValidationException::withMessages([
                'password' => [__('auth.password')],
            ]);
        }

        if (! $this->passkeys->delete($user, $passkey)) {
            throw ValidationException::withMessages([
                'credential' => [__('auth.passkey_not_found')],
            ]);
        }

        $this->mfa->reconcileFactors($user);

        return response()->json(['data' => new UserResource($user->fresh())]);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /**
     * @return array{id: int, name: string, transports: list<string>, created_at: ?string, last_used_at: ?string}
     */
    private function present(WebauthnCredential $credential): array
    {
        return [
            'id' => $credential->id,
            'name' => $credential->name,
            'transports' => $credential->transports ?? [],
            'created_at' => $credential->created_at?->toIso8601String(),
            'last_used_at' => $credential->last_used_at?->toIso8601String(),
        ];
    }
}
