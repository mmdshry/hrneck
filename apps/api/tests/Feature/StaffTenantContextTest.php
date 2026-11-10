<?php

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\User;
use App\Support\StaffTenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

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
        ->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'NewPass!234',
        ])
        ->assertOk()
        ->assertJsonPath('mfa_required', false);
});

test('staff tenant gate does not allow horizon and requires matching tenant', function () {
    $staff = platformAdmin();
    $origin = ['Origin' => 'http://hrneck.test'];

    $this->actingAs($staff)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    expect(Gate::forUser($staff)->allows('viewHorizon'))->toBeFalse()
        ->and(Gate::forUser($staff)->allows('viewTelescope'))->toBeFalse();

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'company'])
        ->getJson('/api/v1/org/targets')
        ->assertForbidden();
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
        ->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'DemoPass!234',
        ])
        ->assertOk()
        ->assertJsonPath('mfa_required', false)
        ->assertJsonPath('data.is_platform_staff', true);
});
