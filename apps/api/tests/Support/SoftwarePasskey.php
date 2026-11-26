<?php

namespace Tests\Support;

use OpenSSLAsymmetricKey;
use RuntimeException;

/**
 * Software authenticator for feature tests.
 *
 * Creates real ES256 signatures and "none" attestations, so the WebAuthn library
 * runs its full verification path. Output matches the JSON that
 * navigator.credentials returns in the browser (base64url-encoded fields).
 */
final class SoftwarePasskey
{
    public readonly string $credentialId;

    private readonly OpenSSLAsymmetricKey $privateKey;

    private readonly string $cosePublicKey;

    private int $signCount = 0;

    public function __construct(
        private readonly string $rpId = 'hrneck.test',
        ?string $credentialId = null,
    ) {
        $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        if ($key === false) {
            throw new RuntimeException('Could not generate an EC key pair for the test authenticator.');
        }

        $details = openssl_pkey_get_details($key);
        if (! is_array($details) || ! isset($details['ec']['x'], $details['ec']['y'])) {
            throw new RuntimeException('Could not read the EC public key coordinates.');
        }

        $x = str_pad((string) $details['ec']['x'], 32, "\0", STR_PAD_LEFT);
        $y = str_pad((string) $details['ec']['y'], 32, "\0", STR_PAD_LEFT);

        // COSE_Key map: {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}
        $this->cosePublicKey = "\xA5\x01\x02\x03\x26\x20\x01\x21\x58\x20".$x."\x22\x58\x20".$y;
        $this->privateKey = $key;
        $this->credentialId = $credentialId ?? random_bytes(32);
    }

    /**
     * Response to navigator.credentials.create() for the given challenge.
     *
     * @return array<string, mixed>
     */
    public function attestation(string $challenge, string $origin): array
    {
        $authData = hash('sha256', $this->rpId, true)
            ."\x45" // UP | UV | AT
            .pack('N', 0)
            .str_repeat("\0", 16) // aaguid
            .pack('n', strlen($this->credentialId))
            .$this->credentialId
            .$this->cosePublicKey;

        $attestationObject = "\xA3"
            .self::cborText('fmt').self::cborText('none')
            .self::cborText('attStmt')."\xA0"
            .self::cborText('authData').self::cborBytes($authData);

        return [
            'id' => self::b64u($this->credentialId),
            'rawId' => self::b64u($this->credentialId),
            'type' => 'public-key',
            'response' => [
                'clientDataJSON' => self::b64u($this->clientData('webauthn.create', $challenge, $origin)),
                'attestationObject' => self::b64u($attestationObject),
                'transports' => ['internal'],
            ],
        ];
    }

    /**
     * Response to navigator.credentials.get() for the given challenge.
     *
     * @return array<string, mixed>
     */
    public function assertion(string $challenge, string $origin, ?string $userHandle = null): array
    {
        $this->signCount++;

        $authData = hash('sha256', $this->rpId, true)."\x05".pack('N', $this->signCount);
        $clientData = $this->clientData('webauthn.get', $challenge, $origin);

        openssl_sign(
            $authData.hash('sha256', $clientData, true),
            $signature,
            $this->privateKey,
            OPENSSL_ALGO_SHA256,
        );

        return [
            'id' => self::b64u($this->credentialId),
            'rawId' => self::b64u($this->credentialId),
            'type' => 'public-key',
            'response' => [
                'clientDataJSON' => self::b64u($clientData),
                'authenticatorData' => self::b64u($authData),
                'signature' => self::b64u($signature),
                'userHandle' => $userHandle === null ? null : self::b64u($userHandle),
            ],
        ];
    }

    private function clientData(string $type, string $challenge, string $origin): string
    {
        return json_encode([
            'type' => $type,
            'challenge' => $challenge,
            'origin' => $origin,
            'crossOrigin' => false,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    private static function cborText(string $value): string
    {
        return chr(0x60 | strlen($value)).$value;
    }

    private static function cborBytes(string $value): string
    {
        $length = strlen($value);

        if ($length < 24) {
            return chr(0x40 | $length).$value;
        }

        if ($length < 256) {
            return "\x58".chr($length).$value;
        }

        return "\x59".pack('n', $length).$value;
    }

    private static function b64u(string $binary): string
    {
        return rtrim(strtr(base64_encode($binary), '+/', '-_'), '=');
    }
}
