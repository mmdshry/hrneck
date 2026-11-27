<?php

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\User;
use App\Support\StaffTenant;
use Illuminate\Support\Facades\Hash;

test('platform staff can enter tenant context and call org apis', function () {
    $staff = platformAdmin();
    $origin = ['Origin' => 'http://hrneck.test'];

    $this->actingAs($staff)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk()
        ->assertJsonPath('data.acting_in_tenant', true)
        ->assertJsonPath('data.staff_tenant_id', 'itneck');

    expect(StaffTenant::id())->toBe('itneck');

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/targets')
        ->assertOk();

    $this->actingAs($staff)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/leave')
        ->assertOk()
        ->assertJsonPath('data.acting_in_tenant', false);

    expect(StaffTenant::id())->toBeNull();

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/targets')
        ->assertForbidden();
});

test('org user with global platform role cannot access msp', function () {
    $org = orgAdmin();
    setPermissionsTeamId(null);
    $role = Role::findOrCreate(OrgPermissionCatalog::PLATFORM_AGENT, OrgPermissionCatalog::GUARD);
    $org->assignRole($role);
    setPermissionsTeamId(null);

    expect($org->isPlatformStaff())->toBeFalse();

    $this->actingAs($org)
        ->getJson('/api/v1/msp/tenants')
        ->assertForbidden();
});

test('password change succeeds for authenticated user', function () {
    $user = User::factory()->create([
        'tenant_id' => 'itneck',
        'password' => Hash::make('OldPass!234'),
    ]);

    $this->actingAs($user)
        ->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/auth/password', [
            'current_password' => 'OldPass!234',
            'password' => 'NewPass!234',
            'password_confirmation' => 'NewPass!234',
        ])
        ->assertOk();

    $user->refresh();
    expect($user->remember_token)->not->toBeNull();

    $this->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/auth/login', tenantLoginBody('itneck', $user->email, 'NewPass!234'))
        ->assertOk()
        ->assertJsonPath('mfa_required', false);
});

test('platform super admin gets roles and settings inside an entered tenant and requires matching tenant', function () {
    $staff = platformAdmin();
    $origin = ['Origin' => 'http://hrneck.test'];

    $this->actingAs($staff)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/targets')
        ->assertOk();

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/settings')
        ->assertOk();

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/roles')
        ->assertOk();

    $permissions = $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->json('data.permissions');

    expect($permissions)
        ->toContain(OrgPermissionCatalog::ROLES_MANAGE)
        ->toContain(OrgPermissionCatalog::SETTINGS_MANAGE);

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'company'])
        ->getJson('/api/v1/org/targets')
        ->assertForbidden();
});

test('platform agent acting in a tenant cannot manage roles or settings', function () {
    $agent = User::query()->create([
        'name' => 'Platform Agent',
        'email' => 'platform-agent-'.uniqid('', true).'@hrneck.test',
        'password' => Hash::make('DemoPass!234'),
        'tenant_id' => null,
    ]);
    $agent->forceFill(['email_verified_at' => now()])->save();

    setPermissionsTeamId(null);
    $agent->syncRoles([OrgPermissionCatalog::PLATFORM_AGENT]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->actingAs($agent)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    $this->actingAs($agent)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/targets')
        ->assertOk();

    $this->actingAs($agent)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/settings')
        ->assertForbidden();

    $this->actingAs($agent)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/roles')
        ->assertForbidden();

    $permissions = $this->actingAs($agent)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->json('data.permissions');

    expect($permissions)
        ->not->toContain(OrgPermissionCatalog::ROLES_MANAGE)
        ->not->toContain(OrgPermissionCatalog::SETTINGS_MANAGE);
});

test('logout clears staff tenant context', function () {
    $staff = platformAdmin();
    $origin = ['Origin' => 'http://hrneck.test'];

    $this->actingAs($staff)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    $this->actingAs($staff)
        ->withHeaders($origin)
        ->postJson('/api/v1/auth/logout')
        ->assertOk();

    expect(StaffTenant::id())->toBeNull();
});

test('filament-created style platform user can login to spa', function () {
    $user = User::query()->create([
        'name' => 'Filament Platform',
        'email' => 'filament-platform-'.uniqid('', true).'@hrneck.test',
        'password' => Hash::make('DemoPass!234'),
        'tenant_id' => null,
    ]);
    $user->forceFill(['email_verified_at' => now()])->save();

    setPermissionsTeamId(null);
    $user->syncRoles([OrgPermissionCatalog::PLATFORM_SUPER_ADMIN]);

    $this->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/auth/login', staffLoginBody($user->email, 'DemoPass!234'))
        ->assertOk()
        ->assertJsonPath('mfa_required', false)
        ->assertJsonPath('data.is_platform_staff', true);
});
