<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class MfaService
{
    public function __construct(private readonly Google2FA $google2fa = new Google2FA) {}

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

    public function confirmSetup(User $user, string $code): bool
    {
        $encrypted = cache()->get($this->pendingSetupKey($user));
        if (! is_string($encrypted) || $encrypted === '') {
            return false;
        }

        $secret = Crypt::decryptString($encrypted);
        if (! $this->google2fa->verifyKey($secret, $code)) {
            return false;
        }

        $user->forceFill([
            'mfa_secret' => Crypt::encryptString($secret),
            'mfa_enabled' => true,
            'mfa_confirmed_at' => now(),
        ])->save();

        cache()->forget($this->pendingSetupKey($user));

        return true;
    }

    public function verify(User $user, string $code): bool
    {
        if (! $user->mfa_enabled || ! $user->mfa_secret) {
            return false;
        }

        return $this->google2fa->verifyKey(Crypt::decryptString($user->mfa_secret), $code);
    }

    public function issueChallengeToken(User $user): string
    {
        $token = Str::random(64);
        cache()->put($this->cacheKey($token), $user->id, now()->addMinutes(10));

        return $token;
    }

    public function userFromChallengeToken(string $token): ?User
    {
        $userId = cache()->pull($this->cacheKey($token));

        return $userId ? User::query()->find($userId) : null;
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
