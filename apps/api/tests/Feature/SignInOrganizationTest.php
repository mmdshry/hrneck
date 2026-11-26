<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\EnsureTenantMembership;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use PragmaRX\Google2FA\Google2FA;

test('a login with accounts in several organizations lists them and leaves the choice open', function () {
    $email = 'several.orgs@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Several', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Several', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'OtherPass!234'])
        ->assertOk()
        ->assertJsonPath('data.needs_org_selection', true)
        ->assertJsonPath('data.active_tenant_id', null)
        ->assertJsonCount(2, 'data.organizations')
        ->assertJsonPath('data.organizations.0.tenant_id', 'company')
        ->assertJsonPath('data.organizations.0.requires_password', false)
        ->assertJsonPath('data.organizations.1.tenant_id', 'itneck')
        ->assertJsonPath('data.organizations.1.requires_password', true);
});

test('one password shared by several organization logins asks for the organization, then enters it', function () {
    $email = 'shared.password@example.test';
    $password = 'DemoPass!234';
    app(CreateOrgUser::class)->handle('itneck', 'Twin', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Twin', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $challenge = $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password])
        ->assertOk()
        ->assertJsonPath('org_choice_required', true)
        ->assertJsonCount(2, 'organizations')
        ->json('challenge_token');

    expect($challenge)->toBeString()->not->toBeEmpty();

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login/org', ['challenge_token' => $challenge, 'tenant' => 'company'])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company')
        ->assertJsonPath('data.needs_org_selection', false);

    // The challenge is single use.
    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login/org', ['challenge_token' => $challenge, 'tenant' => 'company'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['challenge_token']);
});

test('choosing an organization outside the challenge keeps the challenge usable', function () {
    $email = 'wrong.choice@example.test';
    $password = 'DemoPass!234';
    app(CreateOrgUser::class)->handle('itneck', 'Choice', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Choice', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $challenge = $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password])
        ->json('challenge_token');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login/org', ['challenge_token' => $challenge, 'tenant' => 'mmdshry'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['tenant']);

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login/org', ['challenge_token' => 'not-a-real-token', 'tenant' => 'company'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['challenge_token']);

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login/org', ['challenge_token' => $challenge, 'tenant' => 'itneck'])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'itneck');
});

test('switching to another organization login needs that login password', function () {
    $email = 'switch.password@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Switch', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Switch', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234'])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', null);

    // The password of the organization being switched to is required, not the current one.
    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/switch', ['password' => 'DemoPass!234'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['password']);

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/switch', ['password' => 'OtherPass!234'])
        ->assertOk()
        ->assertJsonPath('mfa_required', false)
        ->assertJsonPath('data.tenant_id', 'company')
        ->assertJsonPath('data.active_tenant_id', 'company');

    $this->withHeaders($origin)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.email', $email)
        ->assertJsonPath('data.active_tenant_id', 'company');
});

test('switching to an organization login with MFA completes after the second factor', function () {
    $email = 'switch.mfa@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Mfa', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Mfa', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $google2fa = new Google2FA;
    $secret = $google2fa->generateSecretKey();
    User::query()->withEmail($email)->where('tenant_id', 'company')->firstOrFail()
        ->forceFill(['mfa_enabled' => true, 'mfa_secret' => Crypt::encryptString($secret)])
        ->save();

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234'])
        ->assertOk();

    $challenge = $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/switch', ['password' => 'OtherPass!234'])
        ->assertOk()
        ->assertJsonPath('mfa_required', true)
        ->json('challenge_token');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/mfa/verify', ['challenge_token' => $challenge, 'code' => $google2fa->getCurrentOtp($secret)])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company');
});

test('a login choice that needs MFA keeps the chosen organization active after the second factor', function () {
    $email = 'choice.mfa@example.test';
    $password = 'DemoPass!234';
    app(CreateOrgUser::class)->handle('itneck', 'ChoiceMfa', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'ChoiceMfa', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);

    $google2fa = new Google2FA;
    $secret = $google2fa->generateSecretKey();
    User::query()->withEmail($email)->where('tenant_id', 'company')->firstOrFail()
        ->forceFill(['mfa_enabled' => true, 'mfa_secret' => Crypt::encryptString($secret)])
        ->save();

    $origin = ['Origin' => 'http://hrneck.test'];

    $challenge = $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password])
        ->json('challenge_token');

    $mfaChallenge = $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login/org', ['challenge_token' => $challenge, 'tenant' => 'company'])
        ->assertOk()
        ->assertJsonPath('mfa_required', true)
        ->json('challenge_token');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/mfa/verify', ['challenge_token' => $mfaChallenge, 'code' => $google2fa->getCurrentOtp($secret)])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company');
});

test('organizations the user can enter with the same password are listed without another password', function () {
    $email = 'shared.account@example.test';
    $user = app(CreateOrgUser::class)->handle('itneck', 'Shared', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(EnsureTenantMembership::class)->handle($user, 'company');

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234'])
        ->assertOk()
        ->assertJsonPath('data.needs_org_selection', true)
        ->assertJsonCount(2, 'data.organizations')
        ->assertJsonPath('data.organizations.0.requires_password', false)
        ->assertJsonPath('data.organizations.1.requires_password', false);

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/enter')
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company');
});

test('an organization login whose membership is disabled is not listed', function () {
    $email = 'disabled.org@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Disabled', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Disabled', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    TenantMembership::query()->where('tenant_id', 'company')->update(['disabled_at' => now()]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234'])
        ->assertOk()
        ->assertJsonPath('data.needs_org_selection', false)
        ->assertJsonCount(1, 'data.organizations');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/switch', ['password' => 'OtherPass!234'])
        ->assertForbidden();
});

test('switching is refused for the current organization and for organizations without a login', function () {
    $email = 'refused.switch@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Refused', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Refused', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234'])
        ->assertOk();

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/itneck/switch', ['password' => 'DemoPass!234'])
        ->assertForbidden();

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/mmdshry/switch', ['password' => 'DemoPass!234'])
        ->assertForbidden();
});

test('a shared membership row is not duplicated when the same organization has two logins', function () {
    $email = 'no.duplicate@example.test';
    $user = app(CreateOrgUser::class)->handle('itneck', 'Dup', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(EnsureTenantMembership::class)->handle($user, 'company');
    app(CreateOrgUser::class)->handle('company', 'Dup', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234'])
        ->assertOk()
        ->assertJsonCount(2, 'data.organizations')
        ->assertJsonPath('data.organizations.0.tenant_id', 'itneck')
        ->assertJsonPath('data.organizations.0.requires_password', false)
        ->assertJsonPath('data.organizations.1.tenant_id', 'company')
        ->assertJsonPath('data.organizations.1.requires_password', false);
});

test('the organization sign-in address makes that organization active straight after sign-in', function () {
    $email = 'address.hint@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Hint', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Hint', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'OtherPass!234', 'tenant' => 'company'])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company')
        ->assertJsonPath('data.needs_org_selection', false);

    $this->withHeaders($origin)
        ->getJson('/api/v1/auth/me')
        ->assertJsonPath('data.active_tenant_id', 'company');
});

test('the organization sign-in address activates a home login that also has other memberships', function () {
    $email = 'home.hint@example.test';
    $user = app(CreateOrgUser::class)->handle('itneck', 'HomeHint', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(EnsureTenantMembership::class)->handle($user, 'company');

    $this->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234', 'tenant' => 'itneck'])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'itneck')
        ->assertJsonPath('data.needs_org_selection', false);
});

test('a membership alone does not sign a login in at another organization address', function () {
    $email = 'membership.only@example.test';
    $user = app(CreateOrgUser::class)->handle('itneck', 'Member', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(EnsureTenantMembership::class)->handle($user, 'company');

    $this->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'DemoPass!234', 'tenant' => 'company'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('an organization address the login cannot enter leaves the organization unchosen', function () {
    $email = 'address.disabled@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'HintOff', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'HintOff', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    TenantMembership::query()->where('tenant_id', 'company')->update(['disabled_at' => now()]);

    $this->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'OtherPass!234', 'tenant' => 'company'])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', null)
        ->assertJsonPath('data.needs_org_selection', true);
});

test('the organization sign-in address stays active after the second factor', function () {
    $email = 'address.mfa@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'HintMfa', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'HintMfa', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $google2fa = new Google2FA;
    $secret = $google2fa->generateSecretKey();
    User::query()->withEmail($email)->where('tenant_id', 'company')->firstOrFail()
        ->forceFill(['mfa_enabled' => true, 'mfa_secret' => Crypt::encryptString($secret)])
        ->save();

    $origin = ['Origin' => 'http://hrneck.test'];

    $challenge = $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'OtherPass!234', 'tenant' => 'company'])
        ->assertOk()
        ->assertJsonPath('mfa_required', true)
        ->json('challenge_token');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/mfa/verify', ['challenge_token' => $challenge, 'code' => $google2fa->getCurrentOtp($secret)])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company');
});
