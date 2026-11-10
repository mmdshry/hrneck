<?php

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

test('mfa setup keeps existing mfa enabled until confirm', function () {
    $google2fa = new Google2FA;
    $existingSecret = $google2fa->generateSecretKey();

    $user = User::factory()->create([
        'password' => Hash::make('DemoPass!234'),
    ]);
    $user->forceFill([
        'mfa_secret' => Crypt::encryptString($existingSecret),
        'mfa_enabled' => true,
        'mfa_confirmed_at' => now(),
    ])->save();

    $setup = $this->actingAs($user)
        ->postJson('/api/v1/auth/mfa/setup')
        ->assertOk()
        ->assertJsonStructure(['secret', 'otpauth_url', 'qr_svg'])
        ->json();

    $user->refresh();
    expect($user->mfa_enabled)->toBeTrue()
        ->and(Crypt::decryptString($user->mfa_secret))->toBe($existingSecret);

    $code = $google2fa->getCurrentOtp($setup['secret']);

    $confirm = $this->actingAs($user)
        ->postJson('/api/v1/auth/mfa/confirm', ['code' => $code])
        ->assertOk()
        ->json();

    expect($confirm['recovery_codes'])->toBeArray()->toHaveCount(8);

    $user->refresh();
    expect($user->mfa_enabled)->toBeTrue()
        ->and(Crypt::decryptString($user->mfa_secret))->toBe($setup['secret']);
});

test('wrong mfa code keeps challenge token usable', function () {
    $google2fa = new Google2FA;
    $secret = $google2fa->generateSecretKey();
    $user = User::factory()->create([
        'password' => Hash::make('DemoPass!234'),
    ]);
    $user->forceFill([
        'mfa_secret' => Crypt::encryptString($secret),
        'mfa_enabled' => true,
        'mfa_confirmed_at' => now(),
    ])->save();

    $login = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ])->assertOk()->json();

    expect($login['mfa_required'])->toBeTrue();
    $token = $login['challenge_token'];

    $this->postJson('/api/v1/auth/mfa/verify', [
        'challenge_token' => $token,
        'code' => '000000',
    ])->assertStatus(422);

    $code = $google2fa->getCurrentOtp($secret);

    $this->postJson('/api/v1/auth/mfa/verify', [
        'challenge_token' => $token,
        'code' => $code,
    ])->assertOk()
        ->assertJsonPath('data.email', $user->email);
});

test('recovery code works once then burns', function () {
    $user = User::factory()->create([
        'password' => Hash::make('DemoPass!234'),
    ]);
    $plain = 'abcd-efghijkl';
    $user->forceFill([
        'mfa_secret' => Crypt::encryptString((new Google2FA)->generateSecretKey()),
        'mfa_enabled' => true,
        'mfa_confirmed_at' => now(),
        'mfa_recovery_codes' => [Hash::make($plain)],
    ])->save();

    $login = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ])->assertOk()->json();

    $this->postJson('/api/v1/auth/mfa/verify', [
        'challenge_token' => $login['challenge_token'],
        'code' => $plain,
    ])->assertOk();

    $user->refresh();
    expect($user->mfa_recovery_codes)->toBe([]);

    $login2 = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ])->assertOk()->json();

    $this->postJson('/api/v1/auth/mfa/verify', [
        'challenge_token' => $login2['challenge_token'],
        'code' => $plain,
    ])->assertStatus(422);
});

test('mfa can be disabled with password and totp', function () {
    $google2fa = new Google2FA;
    $secret = $google2fa->generateSecretKey();
    $user = User::factory()->create([
        'password' => Hash::make('DemoPass!234'),
    ]);
    $user->forceFill([
        'mfa_secret' => Crypt::encryptString($secret),
        'mfa_enabled' => true,
        'mfa_confirmed_at' => now(),
        'mfa_recovery_codes' => [Hash::make('aaaa-bbbb')],
    ])->save();

    $this->actingAs($user)
        ->postJson('/api/v1/auth/mfa/disable', [
            'password' => 'DemoPass!234',
            'code' => $google2fa->getCurrentOtp($secret),
        ])
        ->assertOk()
        ->assertJsonPath('data.mfa_enabled', false);

    $user->refresh();
    expect($user->mfa_enabled)->toBeFalse()
        ->and($user->mfa_secret)->toBeNull();
});
