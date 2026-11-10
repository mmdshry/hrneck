<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class MfaService
{
    private const RECOVERY_CODE_COUNT = 8;

    public function __construct(private readonly Google2FA $google2fa = new Google2FA) {}

    /**
     * @return array{secret: string, otpauth_url: string, qr_svg: string}
     */
    public function beginSetup(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey();
        // Keep existing MFA active until confirmSetup succeeds.
        cache()->put(
            $this->pendingSetupKey($user),
            Crypt::encryptString($secret),
            now()->addMinutes(15),
        );

        $otpauth = $this->google2fa->getQRCodeUrl(
            (string) config('brand.short'),
            $user->email,
            $secret,
        );

        $writer = new Writer(new ImageRenderer(new RendererStyle(200), new SvgImageBackEnd));

        return [
            'secret' => $secret,
            'otpauth_url' => $otpauth,
            'qr_svg' => $writer->writeString($otpauth),
        ];
    }

    /**
     * @return list<string>|null Plaintext recovery codes (shown once) or null on failure.
     */
    public function confirmSetup(User $user, string $code): ?array
    {
        $encrypted = cache()->get($this->pendingSetupKey($user));
        if (! is_string($encrypted) || $encrypted === '') {
            return null;
        }

        $secret = Crypt::decryptString($encrypted);
        if (! $this->google2fa->verifyKey($secret, $code)) {
            return null;
        }

        $plainCodes = $this->generateRecoveryCodes();

        $user->forceFill([
            'mfa_secret' => Crypt::encryptString($secret),
            'mfa_enabled' => true,
            'mfa_confirmed_at' => now(),
            'mfa_recovery_codes' => $this->hashRecoveryCodes($plainCodes),
        ])->save();

        cache()->forget($this->pendingSetupKey($user));

        return $plainCodes;
    }

    public function verify(User $user, string $code): bool
    {
        if (! $user->mfa_enabled || ! $user->mfa_secret) {
            return false;
        }

        $secret = Crypt::decryptString($user->mfa_secret);
        $cacheKey = 'mfa_totp_ts:'.$user->id;
        $last = cache()->get($cacheKey);
        $lastTs = is_int($last) ? $last : ($this->google2fa->getTimestamp() - 2);

        $timestamp = $this->google2fa->verifyKeyNewer($secret, $code, $lastTs);
        if ($timestamp === false) {
            return false;
        }

        cache()->put($cacheKey, (int) $timestamp, now()->addMinutes(10));

        return true;
    }

    public function verifyRecoveryCode(User $user, string $code): bool
    {
        return (bool) DB::transaction(function () use ($user, $code): bool {
            /** @var User|null $locked */
            $locked = User::query()->whereKey($user->getKey())->lockForUpdate()->first();
            if (! $locked instanceof User) {
                return false;
            }

            $codes = $locked->mfa_recovery_codes;
            if (! is_array($codes) || $codes === []) {
                return false;
            }

            foreach ($codes as $index => $hash) {
                if (! is_string($hash) || ! Hash::check($code, $hash)) {
                    continue;
                }

                unset($codes[$index]);
                $locked->forceFill([
                    'mfa_recovery_codes' => array_values($codes),
                ])->save();
                $user->setRawAttributes($locked->getAttributes(), true);

                return true;
            }

            return false;
        });
    }

    public function disable(User $user): void
    {
        $user->forceFill([
            'mfa_secret' => null,
            'mfa_enabled' => false,
            'mfa_confirmed_at' => null,
            'mfa_recovery_codes' => null,
        ])->save();

        cache()->forget($this->pendingSetupKey($user));
        cache()->forget('mfa_totp_ts:'.$user->id);
    }

    public function issueChallengeToken(User $user, bool $remember = false): string
    {
        $token = Str::random(64);
        cache()->put(
            $this->cacheKey($token),
            [
                'user_id' => $user->id,
                'remember' => $remember,
            ],
            now()->addMinutes(10),
        );

        return $token;
    }

    /**
     * @return array{user: User, remember: bool}|null
     */
    public function challengeFromToken(string $token): ?array
    {
        $payload = cache()->get($this->cacheKey($token));
        if (! is_array($payload) || ! isset($payload['user_id'])) {
            return null;
        }

        $user = User::query()->find($payload['user_id']);
        if (! $user instanceof User) {
            return null;
        }

        return [
            'user' => $user,
            'remember' => (bool) ($payload['remember'] ?? false),
        ];
    }

    public function consumeChallengeToken(string $token): void
    {
        cache()->forget($this->cacheKey($token));
    }

    /**
     * @return list<string>
     */
    public function generateRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < self::RECOVERY_CODE_COUNT; $i++) {
            $codes[] = Str::lower(Str::random(10).'-'.Str::random(10));
        }

        return $codes;
    }

    /**
     * @param  list<string>  $codes
     * @return list<string>
     */
    public function hashRecoveryCodes(array $codes): array
    {
        return array_map(
            static fn (string $code): string => Hash::make($code),
            $codes,
        );
    }

    private function cacheKey(string $token): string
    {
        return 'mfa_challenge:'.$token;
    }

    private function pendingSetupKey(User $user): string
    {
        return 'mfa_pending_setup:'.$user->id;
    }
}
