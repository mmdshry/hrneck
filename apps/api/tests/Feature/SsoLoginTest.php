<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\EnsureTenantMembership;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\IdentityAccess\Support\SsoProvider;
use App\Models\User;
use App\Models\UserIdentity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Testing\TestResponse;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

beforeEach(function () {
    config([
        'services.google.client_id' => 'google-client-id',
        'services.azure.client_id' => 'azure-client-id',
    ]);
});

test('links a provisioned user by verified Google email and starts a session', function () {
    $user = User::factory()->unverified()->create(['email' => 'ana@example.com', 'tenant_id' => 'itneck']);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));

    $token = ssoHandoffToken($this, 'google', $flow);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk()
        ->assertJsonPath('data.email', 'ana@example.com');

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->getJson('/api/v1/auth/me')
        ->assertJsonPath('data.email', 'ana@example.com');

    expect(UserIdentity::query()->where('user_id', $user->id)->where('provider', 'google')->where('subject', 'google-subject-1')->exists())->toBeTrue()
        ->and($user->refresh()->email_verified_at)->not->toBeNull();
});

test('matches an existing identity by subject even when the provider email changed', function () {
    $user = User::factory()->create(['email' => 'old@example.com', 'tenant_id' => 'itneck']);
    UserIdentity::factory()->create([
        'user_id' => $user->id,
        'provider' => 'google',
        'subject' => 'google-subject-1',
    ]);
    $flow = ssoFakeProvider('google', ssoGoogleUser('new@example.com'));

    $token = ssoHandoffToken($this, 'google', $flow);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk()
        ->assertJsonPath('data.email', 'old@example.com');

    expect(UserIdentity::query()->count())->toBe(1)
        ->and(User::query()->where('email', 'new@example.com')->exists())->toBeFalse();
});

test('links a Microsoft work account by its mail attribute without an email_verified claim', function () {
    $user = User::factory()->unverified()->create(['email' => 'ana@contoso.com', 'tenant_id' => 'itneck']);
    $flow = ssoFakeProvider('microsoft', ssoMicrosoftUser('ana@contoso.com', mail: 'ana@contoso.com'));

    $token = ssoHandoffToken($this, 'microsoft', $flow);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk()
        ->assertJsonPath('data.email', 'ana@contoso.com');

    expect(UserIdentity::query()->where('user_id', $user->id)->where('provider', 'microsoft')->exists())->toBeTrue();
});

test('falls back to the Microsoft sign-in name when the mail attribute is empty', function () {
    $user = User::factory()->create(['email' => 'ana@contoso.onmicrosoft.com', 'tenant_id' => 'itneck']);
    $flow = ssoFakeProvider('microsoft', ssoMicrosoftUser('ana@contoso.onmicrosoft.com', mail: null));

    $token = ssoHandoffToken($this, 'microsoft', $flow);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk()
        ->assertJsonPath('data.email', 'ana@contoso.onmicrosoft.com');

    expect(UserIdentity::query()->where('user_id', $user->id)->where('provider', 'microsoft')->exists())->toBeTrue();
});

test('never links an unverified provider email', function () {
    $user = User::factory()->unverified()->create(['email' => 'ana@example.com']);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'), ['email_verified' => false]);

    $callback = ssoCallback($this, 'google', $flow);

    $callback->assertRedirectContains('/login?sso_error=not_linked');
    expect(UserIdentity::query()->count())->toBe(0)
        ->and($user->refresh()->email_verified_at)->toBeNull();
});

test('never creates an account for an unknown identity', function () {
    $before = User::query()->count();
    $flow = ssoFakeProvider('google', ssoGoogleUser('stranger@example.com'));

    ssoCallback($this, 'google', $flow)->assertRedirectContains('/login?sso_error=not_linked');

    expect(User::query()->count())->toBe($before)
        ->and(UserIdentity::query()->count())->toBe(0);
});

test('refuses a disabled account even when its identity is already linked', function () {
    $user = User::factory()->create(['email' => 'ana@example.com', 'tenant_id' => 'itneck', 'disabled_at' => now()]);
    UserIdentity::factory()->create([
        'user_id' => $user->id,
        'provider' => 'google',
        'subject' => 'google-subject-1',
    ]);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));

    ssoCallback($this, 'google', $flow)->assertRedirectContains('/login?sso_error=account_disabled');

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->getJson('/api/v1/auth/me')
        ->assertJsonPath('data', null);
});

test('skips the app MFA for SSO sign-in because the identity provider already did MFA', function () {
    $user = User::factory()->create([
        'email' => 'ana@example.com',
        'tenant_id' => 'itneck',
        'mfa_enabled' => true,
        'mfa_secret' => 'not-used-by-sso',
        'mfa_confirmed_at' => now(),
    ]);
    UserIdentity::factory()->create([
        'user_id' => $user->id,
        'provider' => 'google',
        'subject' => 'google-subject-1',
    ]);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));

    $token = ssoHandoffToken($this, 'google', $flow);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk()
        ->assertJsonMissingPath('challenge_token')
        ->assertJsonMissing(['mfa_required' => true]);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->getJson('/api/v1/auth/me')
        ->assertJsonPath('data.email', 'ana@example.com');
});

test('keeps must_set_password on the account after an SSO sign-in', function () {
    $user = User::factory()->create([
        'email' => 'ana@example.com',
        'tenant_id' => 'itneck',
        'must_set_password' => true,
    ]);
    UserIdentity::factory()->create([
        'user_id' => $user->id,
        'provider' => 'google',
        'subject' => 'google-subject-1',
    ]);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));

    $token = ssoHandoffToken($this, 'google', $flow);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk();

    expect($user->refresh()->must_set_password)->toBeTrue();
});

test('rejects a state that was already used', function () {
    User::factory()->create(['email' => 'ana@example.com', 'tenant_id' => 'itneck']);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));

    ssoHandoffToken($this, 'google', $flow);

    $this->get(ssoCallbackUrl('google', $flow->state, 'auth-code'))
        ->assertRedirectContains('/login?sso_error=invalid_state');
});

test('rejects an unknown state', function () {
    $this->get(ssoCallbackUrl('google', 'forged-state', 'auth-code'))
        ->assertRedirectContains('/login?sso_error=invalid_state');
});

test('an SSO sign-in that started on an organization address activates that organization', function () {
    $user = app(CreateOrgUser::class)->handle('itneck', 'Ana', 'ana@example.com', 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(EnsureTenantMembership::class)->handle($user, 'company');
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));

    $token = ssoHandoffToken($this, 'google', $flow, 'http://company.hrneck.test');

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company');
});

test('links the login of the organization being signed into when logins share an email', function (string $tenant) {
    $email = 'shared.sso@example.com';
    $itneckLogin = User::factory()->create(['email' => $email, 'tenant_id' => 'itneck']);
    $companyLogin = User::factory()->create(['email' => $email, 'tenant_id' => 'company']);
    $flow = ssoFakeProvider('google', ssoGoogleUser($email));

    ssoHandoffToken($this, 'google', $flow, 'http://'.$tenant.'.hrneck.test');

    $linked = $tenant === 'itneck' ? $itneckLogin : $companyLogin;
    $other = $tenant === 'itneck' ? $companyLogin : $itneckLogin;

    expect(UserIdentity::query()->count())->toBe(1)
        ->and(UserIdentity::query()->where('user_id', $linked->id)->exists())->toBeTrue()
        ->and(UserIdentity::query()->where('user_id', $other->id)->exists())->toBeFalse();
})->with(['itneck', 'company']);

test('a platform staff account with the same email is never linked from an organization sign-in page', function () {
    $email = 'platform.and.org@example.com';
    $platform = User::factory()->create(['email' => $email, 'tenant_id' => null]);
    $itneckLogin = User::factory()->create(['email' => $email, 'tenant_id' => 'itneck']);
    $flow = ssoFakeProvider('google', ssoGoogleUser($email));

    ssoHandoffToken($this, 'google', $flow);

    expect(UserIdentity::query()->where('user_id', $itneckLogin->id)->exists())->toBeTrue()
        ->and(UserIdentity::query()->where('user_id', $platform->id)->exists())->toBeFalse();
});

test('an organization sign-in does not link a platform staff account on its own', function () {
    $email = 'platform.only@example.com';
    User::factory()->create(['email' => $email, 'tenant_id' => null]);
    $flow = ssoFakeProvider('google', ssoGoogleUser($email));

    ssoCallback($this, 'google', $flow)->assertRedirectContains('/login?sso_error=not_linked');

    expect(UserIdentity::query()->count())->toBe(0);
});

test('one provider account links to a login in each organization it belongs to', function () {
    $email = 'both.orgs@example.com';
    $itneckLogin = User::factory()->create(['email' => $email, 'tenant_id' => 'itneck']);
    $companyLogin = User::factory()->create(['email' => $email, 'tenant_id' => 'company']);
    $flow = ssoFakeProvider('google', ssoGoogleUser($email));

    ssoHandoffToken($this, 'google', $flow, 'http://itneck.hrneck.test');
    ssoHandoffToken($this, 'google', $flow, 'http://company.hrneck.test');

    expect(UserIdentity::query()->count())->toBe(2)
        ->and(UserIdentity::query()->where('user_id', $itneckLogin->id)->where('subject', 'google-subject-1')->exists())->toBeTrue()
        ->and(UserIdentity::query()->where('user_id', $companyLogin->id)->where('subject', 'google-subject-1')->exists())->toBeTrue();
});

test('an identity linked in one organization does not sign into another organization', function () {
    $email = 'itneck.only@example.com';
    $itneckLogin = User::factory()->create(['email' => $email, 'tenant_id' => 'itneck']);
    UserIdentity::factory()->create([
        'user_id' => $itneckLogin->id,
        'provider' => 'google',
        'subject' => 'google-subject-1',
    ]);
    $flow = ssoFakeProvider('google', ssoGoogleUser($email));

    ssoCallback($this, 'google', $flow, 'http://company.hrneck.test')
        ->assertRedirectContains('/login?sso_error=not_linked');

    expect(UserIdentity::query()->count())->toBe(1);
});

test('a handoff token can be exchanged only once', function () {
    $user = User::factory()->create(['email' => 'ana@example.com', 'tenant_id' => 'itneck']);
    UserIdentity::factory()->create([
        'user_id' => $user->id,
        'provider' => 'google',
        'subject' => 'google-subject-1',
    ]);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));
    $token = ssoHandoffToken($this, 'google', $flow);

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertOk();

    $this->withHeader('Origin', 'http://itneck.hrneck.test')
        ->postJson('/api/v1/auth/oauth/exchange', ['token' => $token])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['token']);
});

test('rejects an ID token whose nonce does not match the request', function () {
    User::factory()->create(['email' => 'ana@example.com']);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'), ['nonce' => 'forged-nonce']);

    ssoCallback($this, 'google', $flow)->assertRedirectContains('/login?sso_error=provider_error');
});

test('rejects an ID token from an issuer that is not the provider', function () {
    User::factory()->create(['email' => 'ana@example.com']);
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'), ['iss' => 'https://evil.test']);

    ssoCallback($this, 'google', $flow)->assertRedirectContains('/login?sso_error=provider_error');
});

test('reports a cancelled consent screen as cancelled', function () {
    $flow = ssoFakeProvider('google', ssoGoogleUser('ana@example.com'));
    $this->get(ssoStartUrl('google'))->assertRedirect();

    $this->get(ssoCallbackUrl('google', $flow->state, error: 'access_denied'))
        ->assertRedirectContains('/login?sso_error=cancelled');
});

test('refuses to start sign-in for a return origin outside the platform', function () {
    Socialite::shouldReceive('driver')->never();

    $this->get(ssoStartUrl('google', returnTo: 'https://evil.test'))
        ->assertRedirectContains('/login?sso_error=invalid_request');
});

test('refuses to start sign-in from the main site or the staff host', function (string $returnTo) {
    Socialite::shouldReceive('driver')->never();

    // SSO signs a person into one organization, so only that organization's own address can start it.
    $this->get(ssoStartUrl('google', returnTo: $returnTo))
        ->assertRedirectContains('/login?sso_error=invalid_request');
})->with([
    'main site' => ['http://hrneck.test'],
    'staff host' => ['http://app.hrneck.test'],
    'www' => ['http://www.hrneck.test'],
]);

test('refuses to start sign-in for a provider without a client id', function (string $provider, string $clientIdKey) {
    config([$clientIdKey => '']);
    Socialite::shouldReceive('driver')->never();

    $this->get(ssoStartUrl($provider))
        ->assertRedirectContains('/login?sso_error=provider_not_configured');
})->with([
    'google' => ['google', 'services.google.client_id'],
    'microsoft' => ['microsoft', 'services.azure.client_id'],
]);

test('treats a whitespace-only client id as not configured', function () {
    config(['services.google.client_id' => "  \t "]);
    Socialite::shouldReceive('driver')->never();

    $this->get(ssoStartUrl('google'))
        ->assertRedirectContains('/login?sso_error=provider_not_configured');
});

test('lists both providers when both have a client id', function () {
    $this->getJson('/api/v1/auth/oauth/providers')
        ->assertOk()
        ->assertExactJson(['data' => ['google', 'microsoft']]);
});

test('lists only the providers that have a client id, and never their secrets', function () {
    config([
        'services.google.client_id' => '',
        'services.google.client_secret' => 'google-secret-value',
        'services.azure.client_secret' => 'azure-secret-value',
    ]);

    $this->getJson('/api/v1/auth/oauth/providers')
        ->assertOk()
        ->assertExactJson(['data' => ['microsoft']])
        ->assertDontSee('google-secret-value')
        ->assertDontSee('azure-secret-value');
});

test('lists no providers when none is configured', function () {
    config([
        'services.google.client_id' => null,
        'services.azure.client_id' => '',
    ]);

    $this->getJson('/api/v1/auth/oauth/providers')
        ->assertOk()
        ->assertExactJson(['data' => []]);
});

/**
 * Builds the path the web app calls to start sign-in. The return origin is the platform host the user is on.
 *
 * @param  array<string, string>  $extra
 */
function ssoStartUrl(string $provider, string $returnTo = 'http://itneck.hrneck.test', array $extra = []): string
{
    return '/api/v1/auth/oauth/'.$provider.'/redirect?'.http_build_query(['return_to' => $returnTo] + $extra);
}

/**
 * Builds the callback path. Parameters are omitted when null, as an identity provider would omit them.
 */
function ssoCallbackUrl(string $provider, string $state, string $code = 'auth-code', ?string $error = null): string
{
    $query = ['state' => $state];
    if ($error !== null) {
        $query['error'] = $error;
    } else {
        $query['code'] = $code;
    }

    return '/api/v1/auth/oauth/'.$provider.'/callback?'.http_build_query($query);
}

/**
 * Runs the redirect and callback steps and returns the response of the callback.
 */
function ssoCallback(TestCase $test, string $provider, stdClass $flow, string $returnTo = 'http://itneck.hrneck.test'): TestResponse
{
    $test->get(ssoStartUrl($provider, $returnTo))->assertRedirect();

    return $test->get(ssoCallbackUrl($provider, $flow->state));
}

/**
 * Runs a successful redirect and callback and returns the one-time handoff token the web app would exchange.
 */
function ssoHandoffToken(TestCase $test, string $provider, stdClass $flow, string $returnTo = 'http://itneck.hrneck.test'): string
{
    $response = ssoCallback($test, $provider, $flow, $returnTo)
        ->assertRedirectContains('/login/sso/complete?token=');

    parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

    return (string) $query['token'];
}

function ssoGoogleUser(string $email, string $subject = 'google-subject-1'): SocialiteUser
{
    $user = new SocialiteUser;
    $user->map(['id' => $subject, 'name' => 'Ana', 'email' => $email]);

    return $user;
}

function ssoMicrosoftUser(string $email, ?string $mail, string $subject = 'microsoft-subject-1'): SocialiteUser
{
    $user = new SocialiteUser;
    $user->setRaw(['id' => $subject, 'mail' => $mail, 'userPrincipalName' => $email]);
    $user->map(['id' => $subject, 'name' => 'Ana', 'email' => $email]);

    return $user;
}

/**
 * Claims a provider would send for this sign-in. The API does not check the signature, so the token is unsigned here.
 *
 * @return array<string, mixed>
 */
function ssoIdTokenClaims(SsoProvider $provider): array
{
    return match ($provider) {
        SsoProvider::Google => [
            'iss' => 'https://accounts.google.com',
            'aud' => config('services.google.client_id'),
            'sub' => 'google-subject-1',
            'email_verified' => true,
            'exp' => time() + 300,
        ],
        SsoProvider::Microsoft => [
            'iss' => 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
            'aud' => config('services.azure.client_id'),
            'sub' => 'microsoft-subject-1',
            'exp' => time() + 300,
        ],
    };
}

/**
 * @param  array<string, mixed>  $claims
 */
function ssoEncodeIdToken(array $claims): string
{
    $encode = static fn (array $part): string => rtrim(strtr(base64_encode(json_encode($part, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');

    return $encode(['alg' => 'none', 'typ' => 'JWT']).'.'.$encode($claims).'.c2ln';
}

/**
 * Replaces the Socialite driver for one sign-in. The redirect step records the state and nonce the API generated, and
 * the token step answers with an ID token that carries that nonce, as the provider would.
 *
 * @param  array<string, mixed>  $idTokenOverrides
 */
function ssoFakeProvider(string $provider, SocialiteUser $ssoUser, array $idTokenOverrides = []): stdClass
{
    $sso = SsoProvider::from($provider);
    $flow = new stdClass;
    $flow->state = null;
    $flow->nonce = null;

    $driver = Mockery::mock(AbstractProvider::class);
    $driver->shouldReceive('stateless')->andReturnSelf();
    $driver->shouldReceive('setScopes')->andReturnSelf();
    $driver->shouldReceive('with')->andReturnUsing(function (array $parameters) use ($driver, $flow) {
        $flow->state = $parameters['state'];
        $flow->nonce = $parameters['nonce'];

        return $driver;
    });
    $driver->shouldReceive('redirect')->andReturn(new RedirectResponse('https://provider.test/authorize'));
    $driver->shouldReceive('getAccessTokenResponse')->andReturnUsing(
        fn () => [
            'access_token' => 'access-token',
            'id_token' => ssoEncodeIdToken(array_merge(
                ssoIdTokenClaims($sso),
                ['nonce' => $flow->nonce],
                $idTokenOverrides,
            )),
        ],
    );
    $driver->shouldReceive('userFromToken')->with('access-token')->andReturn($ssoUser);

    Socialite::shouldReceive('driver')->with($sso->driverName())->andReturn($driver);

    return $flow;
}
