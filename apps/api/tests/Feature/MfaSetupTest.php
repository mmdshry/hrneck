<?php

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

test('mfa setup keeps existing mfa enabled until confirm', function () {
    $google2fa = new Google2FA;
    $existingSecret = $google2fa->generateSecretKey();

    $user = User::query()->create([
        'name' => 'MFA User',
        'email' => 'mfa-setup-'.uniqid('', true).'@hrneck.test',
        'password' => Hash::make('DemoPass!234'),
        'mfa_secret' => Crypt::encryptString($existingSecret),
        'mfa_enabled' => true,
        'mfa_confirmed_at' => now(),
    ]);

    $setup = $this->actingAs($user)
        ->postJson('/api/v1/auth/mfa/setup')
        ->assertOk()
        ->assertJsonStructure(['secret', 'otpauth_url', 'qr_svg'])
        ->json();

    $user->refresh();
    expect($user->mfa_enabled)->toBeTrue()
        ->and(Crypt::decryptString($user->mfa_secret))->toBe($existingSecret);

    $code = $google2fa->getCurrentOtp($setup['secret']);

    $this->actingAs($user)
        ->postJson('/api/v1/auth/mfa/confirm', ['code' => $code])
        ->assertOk();

    $user->refresh();
    expect($user->mfa_enabled)->toBeTrue()
        ->and(Crypt::decryptString($user->mfa_secret))->toBe($setup['secret']);
});
