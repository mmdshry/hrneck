<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\EnsureTenantMembership;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use PragmaRX\Google2FA\Google2FA;

// A login is always started on one organization's address. Moving to another organization that shares the email is a
// separate step, which needs that organization's own password (and MFA).

test('switching to another organization login needs that login password', function () {
    $email = 'switch.password@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Switch', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Switch', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', tenantLoginBody('itneck', $email, 'DemoPass!234'))
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'itneck');

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
        ->postJson('/api/v1/auth/login', tenantLoginBody('itneck', $email, 'DemoPass!234'))
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

test('a membership in another organization is entered without another password', function () {
    $email = 'shared.account@example.test';
    $user = app(CreateOrgUser::class)->handle('itneck', 'Shared', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(EnsureTenantMembership::class)->handle($user, 'company');

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', tenantLoginBody('itneck', $email, 'DemoPass!234'))
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'itneck');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/enter')
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company');
});

test('an organization login whose membership is disabled cannot be switched to', function () {
    $email = 'disabled.org@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Disabled', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Disabled', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    TenantMembership::query()->where('tenant_id', 'company')->update(['disabled_at' => now()]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', tenantLoginBody('itneck', $email, 'DemoPass!234'))
        ->assertOk();

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
        ->postJson('/api/v1/auth/login', tenantLoginBody('itneck', $email, 'DemoPass!234'))
        ->assertOk();

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/itneck/switch', ['password' => 'DemoPass!234'])
        ->assertForbidden();

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/mmdshry/switch', ['password' => 'DemoPass!234'])
        ->assertForbidden();
});

test('the organization sign-in address makes that organization active straight after sign-in', function () {
    $email = 'address.hint@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Hint', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Hint', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', tenantLoginBody('company', $email, 'OtherPass!234'))
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
        ->postJson('/api/v1/auth/login', tenantLoginBody('itneck', $email, 'DemoPass!234'))
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'itneck')
        ->assertJsonPath('data.needs_org_selection', false);
});

test('a membership alone does not sign a login in at another organization address', function () {
    $email = 'membership.only@example.test';
    $user = app(CreateOrgUser::class)->handle('itneck', 'Member', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(EnsureTenantMembership::class)->handle($user, 'company');

    $this->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/auth/login', tenantLoginBody('company', $email, 'DemoPass!234'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('an organization address the login cannot enter leaves the organization unchosen', function () {
    $email = 'address.disabled@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'HintOff', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'HintOff', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    TenantMembership::query()->where('tenant_id', 'company')->update(['disabled_at' => now()]);

    $this->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/auth/login', tenantLoginBody('company', $email, 'OtherPass!234'))
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', null)
        ->assertJsonPath('data.needs_org_selection', true);
});

test('the organization choice step rejects a challenge that login never issued', function () {
    // Login no longer offers a list of organizations (one address, one login), so only a forged challenge reaches this step.
    $this->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/auth/login/org', ['challenge_token' => 'not-a-real-token', 'tenant' => 'company'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['challenge_token']);
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
        ->postJson('/api/v1/auth/login', tenantLoginBody('company', $email, 'OtherPass!234'))
        ->assertOk()
        ->assertJsonPath('mfa_required', true)
        ->json('challenge_token');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/mfa/verify', ['challenge_token' => $challenge, 'code' => $google2fa->getCurrentOtp($secret)])
        ->assertOk()
        ->assertJsonPath('data.active_tenant_id', 'company');
});
