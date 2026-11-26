<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\SoftwarePasskey;
use Tests\TestCase;

beforeEach(function () {
    config([
        'passkeys.rp_id' => 'hrneck.test',
        'passkeys.allowed_origins' => ['https://hrneck.test'],
    ]);
});

/**
 * Runs the registration ceremony for $user through the real API.
 */
function enrollTestPasskey(TestCase $test, User $user, SoftwarePasskey $passkey, string $origin = 'https://hrneck.test'): TestResponse
{
    $options = $test->actingAs($user)
        ->postJson('/api/v1/auth/passkeys/register/options')
        ->assertOk()
        ->json();

    return $test->actingAs($user)->postJson('/api/v1/auth/passkeys/register/verify', [
        'credential' => $passkey->attestation($options['publicKey']['challenge'], $origin),
        'name' => 'Laptop',
    ]);
}

/**
 * Creates a user with a passkey enrolled through the API, returning the authenticator as well.
 *
 * @return array{0: User, 1: SoftwarePasskey}
 */
function passkeyUser(TestCase $test): array
{
    $user = User::factory()->create(['password' => Hash::make('DemoPass!234')]);
    $passkey = new SoftwarePasskey;
    enrollTestPasskey($test, $user, $passkey)->assertOk();

    return [$user, $passkey];
}

/**
 * Starts a password login for a user with MFA and returns the challenge token.
 *
 * Clears the user that actingAs() left on the guard, so the requests that follow
 * come from an unauthenticated browser (and are throttled per IP, not per user).
 */
function startMfaLogin(TestCase $test, User $user): string
{
    Auth::forgetGuards();

    $login = $test->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ])->assertOk()->assertJsonPath('mfa_required', true)->json();

    return $login['challenge_token'];
}

test('registering a passkey enables mfa and issues recovery codes once', function () {
    $user = User::factory()->create(['password' => Hash::make('DemoPass!234')]);

    enrollTestPasskey($this, $user, new SoftwarePasskey)
        ->assertOk()
        ->assertJsonPath('data.mfa_enabled', true)
        ->assertJsonPath('data.mfa_totp_enabled', false)
        ->assertJsonPath('passkey.name', 'Laptop')
        ->assertJsonCount(8, 'recovery_codes');

    $user->refresh();
    expect($user->mfa_enabled)->toBeTrue()
        ->and($user->webauthnCredentials()->count())->toBe(1)
        ->and($user->mfa_recovery_codes)->toHaveCount(8);

    $this->actingAs($user)
        ->getJson('/api/v1/auth/passkeys')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Laptop');
});

test('a registration challenge can only be used once', function () {
    $user = User::factory()->create(['password' => Hash::make('DemoPass!234')]);
    $passkey = new SoftwarePasskey;

    $options = $this->actingAs($user)
        ->postJson('/api/v1/auth/passkeys/register/options')
        ->assertOk()
        ->json();
    $payload = $passkey->attestation($options['publicKey']['challenge'], 'https://hrneck.test');

    $this->actingAs($user)->postJson('/api/v1/auth/passkeys/register/verify', ['credential' => $payload])
        ->assertOk();

    $this->actingAs($user)->postJson('/api/v1/auth/passkeys/register/verify', ['credential' => $payload])
        ->assertStatus(422);
});

test('registration from an origin outside the allowed list is rejected', function () {
    $user = User::factory()->create(['password' => Hash::make('DemoPass!234')]);

    enrollTestPasskey($this, $user, new SoftwarePasskey, origin: 'https://evil.example')
        ->assertStatus(422);

    expect($user->webauthnCredentials()->count())->toBe(0);
});

test('tenant subdomains of the rp id are accepted as origins', function () {
    $user = User::factory()->create(['password' => Hash::make('DemoPass!234')]);

    enrollTestPasskey($this, $user, new SoftwarePasskey, origin: 'https://acme.hrneck.test')
        ->assertOk();
});

test('a passkey completes second-factor sign-in', function () {
    [$user, $passkey] = passkeyUser($this);

    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ])
        ->assertOk()
        ->assertJsonPath('mfa_methods.totp', false)
        ->assertJsonPath('mfa_methods.passkey', true)
        ->json('challenge_token');

    $options = $this->postJson('/api/v1/auth/mfa/passkey/options', ['challenge_token' => $token])
        ->assertOk()
        ->json();

    $this->postJson('/api/v1/auth/mfa/passkey/verify', [
        'challenge_token' => $token,
        'credential' => $passkey->assertion($options['publicKey']['challenge'], 'https://hrneck.test', (string) $user->id),
    ])
        ->assertOk()
        ->assertJsonPath('data.email', $user->email);

    expect($user->webauthnCredentials()->first()->counter)->toBe(1)
        ->and($user->webauthnCredentials()->first()->last_used_at)->not->toBeNull();
});

test('a passkey assertion cannot be replayed against a new challenge', function () {
    [$user, $passkey] = passkeyUser($this);

    $token = startMfaLogin($this, $user);
    $options = $this->postJson('/api/v1/auth/mfa/passkey/options', ['challenge_token' => $token])->json();
    $captured = $passkey->assertion($options['publicKey']['challenge'], 'https://hrneck.test', (string) $user->id);

    $this->postJson('/api/v1/auth/mfa/passkey/verify', [
        'challenge_token' => $token,
        'credential' => $captured,
    ])->assertOk();

    // Enrollment and the first sign-in already used part of the per-minute MFA budget.
    // Let that window expire (the 300s challenge TTL still holds) so only the replay is judged.
    $this->travel(2)->minutes();

    $nextToken = startMfaLogin($this, $user);
    $this->postJson('/api/v1/auth/mfa/passkey/options', ['challenge_token' => $nextToken])->assertOk();

    $this->postJson('/api/v1/auth/mfa/passkey/verify', [
        'challenge_token' => $nextToken,
        'credential' => $captured,
    ])->assertStatus(422);
});

test('an assertion signed by a different key is rejected', function () {
    [$user, $passkey] = passkeyUser($this);

    $token = startMfaLogin($this, $user);
    $options = $this->postJson('/api/v1/auth/mfa/passkey/options', ['challenge_token' => $token])->json();

    $impostor = new SoftwarePasskey(credentialId: $passkey->credentialId);

    $this->postJson('/api/v1/auth/mfa/passkey/verify', [
        'challenge_token' => $token,
        'credential' => $impostor->assertion($options['publicKey']['challenge'], 'https://hrneck.test', (string) $user->id),
    ])->assertStatus(422);

    $user->refresh();
    expect($user->webauthnCredentials()->first()->counter)->toBe(0);
});

test('accounts without a passkey are not offered the passkey method', function () {
    $user = User::factory()->create(['password' => Hash::make('DemoPass!234')]);
    $user->forceFill([
        'mfa_secret' => Crypt::encryptString((new Google2FA)->generateSecretKey()),
        'mfa_enabled' => true,
        'mfa_confirmed_at' => now(),
    ])->save();

    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ])
        ->assertOk()
        ->assertJsonPath('mfa_methods.totp', true)
        ->assertJsonPath('mfa_methods.passkey', false)
        ->json('challenge_token');

    $this->postJson('/api/v1/auth/mfa/passkey/options', ['challenge_token' => $token])
        ->assertStatus(422);
});

test('malformed passkey payloads are validation errors, not server errors', function () {
    [$user] = passkeyUser($this);

    $token = startMfaLogin($this, $user);
    $this->postJson('/api/v1/auth/mfa/passkey/options', ['challenge_token' => $token])->assertOk();

    $this->postJson('/api/v1/auth/mfa/passkey/verify', [
        'challenge_token' => $token,
        'credential' => ['id' => 'not-base64!!', 'response' => ['unexpected' => true]],
    ])->assertStatus(422);
});

test('deleting a passkey requires the password', function () {
    [$user] = passkeyUser($this);
    $id = $user->webauthnCredentials()->value('id');

    $this->actingAs($user)
        ->deleteJson("/api/v1/auth/passkeys/{$id}", ['password' => 'wrong-password'])
        ->assertStatus(422);

    expect($user->webauthnCredentials()->count())->toBe(1);
});

test('deleting the last passkey turns mfa off and clears recovery codes', function () {
    [$user] = passkeyUser($this);
    $id = $user->webauthnCredentials()->value('id');

    $this->actingAs($user)
        ->deleteJson("/api/v1/auth/passkeys/{$id}", ['password' => 'DemoPass!234'])
        ->assertOk()
        ->assertJsonPath('data.mfa_enabled', false);

    $user->refresh();
    expect($user->mfa_enabled)->toBeFalse()
        ->and($user->mfa_recovery_codes)->toBeNull()
        ->and($user->webauthnCredentials()->count())->toBe(0);
});

test('mfa can be disabled by confirming with a passkey', function () {
    [$user, $passkey] = passkeyUser($this);

    $options = $this->actingAs($user)
        ->postJson('/api/v1/auth/passkeys/assertion/options')
        ->assertOk()
        ->json();

    $this->actingAs($user)
        ->postJson('/api/v1/auth/mfa/disable', [
            'password' => 'DemoPass!234',
            'passkey' => $passkey->assertion($options['publicKey']['challenge'], 'https://hrneck.test', (string) $user->id),
        ])
        ->assertOk()
        ->assertJsonPath('data.mfa_enabled', false);

    expect($user->webauthnCredentials()->count())->toBe(0);
});

test('removing the authenticator app keeps mfa on while a passkey remains', function () {
    $user = User::factory()->create(['password' => Hash::make('DemoPass!234')]);
    $user->forceFill([
        'mfa_secret' => Crypt::encryptString((new Google2FA)->generateSecretKey()),
        'mfa_enabled' => true,
        'mfa_confirmed_at' => now(),
    ])->save();
    $user->webauthnCredentials()->create([
        'credential_id' => random_bytes(32),
        'public_key' => 'cose-key',
        'name' => 'Phone',
    ]);

    $user->saveAppAuthenticationSecret(null);

    $user->refresh();
    expect($user->mfa_secret)->toBeNull()
        ->and($user->mfa_enabled)->toBeTrue();
});
