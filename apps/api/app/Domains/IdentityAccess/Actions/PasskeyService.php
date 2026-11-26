<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Models\WebauthnCredential;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Serializer\SerializerInterface;
use Throwable;
use Webauthn\AttestationStatement\AttestationStatementSupportManager;
use Webauthn\AttestationStatement\NoneAttestationStatementSupport;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\AuthenticatorAssertionResponseValidator;
use Webauthn\AuthenticatorAttestationResponse;
use Webauthn\AuthenticatorAttestationResponseValidator;
use Webauthn\AuthenticatorSelectionCriteria;
use Webauthn\CeremonyStep\CeremonyStepManagerFactory;
use Webauthn\Denormalizer\WebauthnSerializerFactory;
use Webauthn\Exception\WebauthnException;
use Webauthn\PublicKeyCredential;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialDescriptor;
use Webauthn\PublicKeyCredentialParameters;
use Webauthn\PublicKeyCredentialRequestOptions;
use Webauthn\PublicKeyCredentialRpEntity;
use Webauthn\PublicKeyCredentialUserEntity;

/**
 * WebAuthn (passkey) ceremonies for the web app.
 *
 * Challenges are stored in the cache as serialized options and pulled on
 * verification, so each one is single-use and expires after
 * config('passkeys.challenge_ttl_seconds').
 */
final class PasskeyService
{
    private const REGISTRATION_KEY = 'webauthn_registration:';

    private const ASSERTION_KEY = 'webauthn_assertion:';

    private readonly SerializerInterface $serializer;

    private readonly AuthenticatorAttestationResponseValidator $attestationValidator;

    private readonly AuthenticatorAssertionResponseValidator $assertionValidator;

    public function __construct()
    {
        $this->serializer = (new WebauthnSerializerFactory(
            new AttestationStatementSupportManager([new NoneAttestationStatementSupport]),
        ))->create();

        $ceremonies = new CeremonyStepManagerFactory;
        $ceremonies->setAllowedOrigins((array) config('passkeys.allowed_origins'), allowSubdomains: true);

        $this->attestationValidator = AuthenticatorAttestationResponseValidator::create($ceremonies->creationCeremony());
        $this->assertionValidator = AuthenticatorAssertionResponseValidator::create($ceremonies->requestCeremony());
    }

    /**
     * @return Collection<int, WebauthnCredential>
     */
    public function credentialsFor(User $user): Collection
    {
        return $user->webauthnCredentials()->latest('id')->get();
    }

    /**
     * Options for navigator.credentials.create(). Attestation is "none": we only need proof of possession.
     *
     * @return array{publicKey: array<string, mixed>}
     */
    public function beginRegistration(User $user): array
    {
        $options = PublicKeyCredentialCreationOptions::create(
            rp: PublicKeyCredentialRpEntity::create(name: $this->rpName(), id: $this->rpId()),
            user: PublicKeyCredentialUserEntity::create(
                name: $user->email,
                id: $this->userHandle($user),
                displayName: $user->name ?: $user->email,
            ),
            challenge: random_bytes(32),
            pubKeyCredParams: [
                PublicKeyCredentialParameters::createPk(-7),   // ES256
                PublicKeyCredentialParameters::createPk(-257), // RS256
            ],
            authenticatorSelection: AuthenticatorSelectionCriteria::create(
                userVerification: AuthenticatorSelectionCriteria::USER_VERIFICATION_REQUIREMENT_PREFERRED,
                residentKey: AuthenticatorSelectionCriteria::RESIDENT_KEY_REQUIREMENT_PREFERRED,
            ),
            attestation: PublicKeyCredentialCreationOptions::ATTESTATION_CONVEYANCE_PREFERENCE_NONE,
            excludeCredentials: $this->credentialsFor($user)
                ->map(fn (WebauthnCredential $credential): PublicKeyCredentialDescriptor => $credential->toCredentialRecord()->getPublicKeyCredentialDescriptor())
                ->values()
                ->all(),
            timeout: (int) config('passkeys.ceremony_timeout_ms'),
        );

        $json = $this->serializer->serialize($options, 'json');
        cache()->put($this->registrationKey($user), $json, now()->addSeconds($this->challengeTtl()));

        return ['publicKey' => $this->decodeJson($json)];
    }

    /**
     * @param  array<string, mixed>  $payload  The browser's attestation response, JSON-decoded.
     *
     * @throws ValidationException
     */
    public function finishRegistration(User $user, array $payload, string $name): WebauthnCredential
    {
        $json = cache()->pull($this->registrationKey($user));
        if (! is_string($json) || $json === '') {
            throw ValidationException::withMessages(['credential' => [__('auth.passkey_challenge_expired')]]);
        }

        $options = $this->serializer->deserialize($json, PublicKeyCredentialCreationOptions::class, 'json');
        $response = $this->parseCredential($payload)->response;
        if (! $response instanceof AuthenticatorAttestationResponse) {
            throw $this->invalidCredential();
        }

        try {
            $record = $this->attestationValidator->check($response, $options, $this->rpId());
        } catch (WebauthnException) {
            throw $this->invalidCredential();
        }

        return $user->webauthnCredentials()->create([
            'credential_id' => $record->publicKeyCredentialId,
            'public_key' => $record->credentialPublicKey,
            'counter' => $record->counter,
            'name' => $name,
            'transports' => $record->transports,
            'aaguid' => $record->aaguid->toRfc4122(),
            'attestation_type' => $record->attestationType,
            'backup_eligible' => $record->backupEligible,
            'backup_status' => $record->backupStatus,
            'uv_initialized' => $record->uvInitialized,
        ]);
    }

    /**
     * Options for navigator.credentials.get() limited to the user's own passkeys.
     *
     * @return array{publicKey: array<string, mixed>}
     */
    public function beginAssertion(User $user): array
    {
        $options = PublicKeyCredentialRequestOptions::create(
            challenge: random_bytes(32),
            rpId: $this->rpId(),
            allowCredentials: $this->credentialsFor($user)
                ->map(fn (WebauthnCredential $credential): PublicKeyCredentialDescriptor => $credential->toCredentialRecord()->getPublicKeyCredentialDescriptor())
                ->values()
                ->all(),
            userVerification: PublicKeyCredentialRequestOptions::USER_VERIFICATION_REQUIREMENT_PREFERRED,
            timeout: (int) config('passkeys.ceremony_timeout_ms'),
        );

        $json = $this->serializer->serialize($options, 'json');
        cache()->put($this->assertionKey($user), $json, now()->addSeconds($this->challengeTtl()));

        return ['publicKey' => $this->decodeJson($json)];
    }

    /**
     * Verifies a passkey assertion for the user. A failed attempt consumes the
     * pending challenge, so the browser must request fresh options to retry.
     *
     * @param  array<string, mixed>  $payload
     */
    public function verifyAssertion(User $user, array $payload): bool
    {
        $json = cache()->pull($this->assertionKey($user));
        if (! is_string($json) || $json === '') {
            return false;
        }

        try {
            $options = $this->serializer->deserialize($json, PublicKeyCredentialRequestOptions::class, 'json');
            $credential = $this->parseCredential($payload);
        } catch (ValidationException) {
            return false;
        }

        $response = $credential->response;
        if (! $response instanceof AuthenticatorAssertionResponse) {
            return false;
        }

        $stored = $user->webauthnCredentials()->where('credential_id', $credential->rawId)->first();
        if (! $stored instanceof WebauthnCredential) {
            return false;
        }

        try {
            $record = $this->assertionValidator->check(
                $stored->toCredentialRecord(),
                $response,
                $options,
                $this->rpId(),
                $response->userHandle,
            );
        } catch (WebauthnException) {
            return false;
        }

        $stored->forceFill([
            'counter' => $record->counter,
            'backup_eligible' => $record->backupEligible,
            'backup_status' => $record->backupStatus,
            'uv_initialized' => $record->uvInitialized,
            'last_used_at' => now(),
        ])->save();

        return true;
    }

    public function delete(User $user, int $id): bool
    {
        $credential = $user->webauthnCredentials()->whereKey($id)->first();
        if (! $credential instanceof WebauthnCredential) {
            return false;
        }

        $credential->delete();

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJson(string $json): array
    {
        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($json, true, flags: JSON_THROW_ON_ERROR);

        return $decoded;
    }

    /**
     * @param  array<string, mixed>  $payload
     *
     * @throws ValidationException
     */
    private function parseCredential(array $payload): PublicKeyCredential
    {
        try {
            $credential = $this->serializer->deserialize(
                json_encode($payload, JSON_THROW_ON_ERROR),
                PublicKeyCredential::class,
                'json',
            );
        } catch (Throwable) {
            // Malformed client input of any shape is a validation error, never a 500.
            throw $this->invalidCredential();
        }

        return $credential;
    }

    private function invalidCredential(): ValidationException
    {
        return ValidationException::withMessages(['credential' => [__('auth.passkey_invalid')]]);
    }

    private function rpId(): string
    {
        return (string) config('passkeys.rp_id');
    }

    private function rpName(): string
    {
        return (string) config('passkeys.rp_name');
    }

    private function challengeTtl(): int
    {
        return (int) config('passkeys.challenge_ttl_seconds');
    }

    /**
     * The WebAuthn user handle must be stable and must not reveal the email, so the primary key is used.
     */
    private function userHandle(User $user): string
    {
        return (string) $user->getKey();
    }

    private function registrationKey(User $user): string
    {
        return self::REGISTRATION_KEY.$user->getKey();
    }

    private function assertionKey(User $user): string
    {
        return self::ASSERTION_KEY.$user->getKey();
    }
}
