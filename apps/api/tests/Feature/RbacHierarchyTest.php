<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Permission;
use App\Models\Role;
use Database\Seeders\DemoSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('platform admin cannot call org apis without tenant membership', function () {
    $platform = platformAdmin();

    $this->actingAs($platform)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets')
        ->assertForbidden();
});

test('org user cannot access another tenant', function () {
    $itneckAdmin = orgAdmin('itneck');

    $this->actingAs($itneckAdmin)
        ->withHeader('X-Tenant', 'company')
        ->getJson('/api/v1/org/targets')
        ->assertForbidden();
});

test('org user without permission is forbidden', function () {
    $viewer = app(CreateOrgUser::class)->handle(
        'itneck',
        'Reports Viewer',
        'viewer@itneck.test',
        'DemoPass!234',
        [],
    );

    setPermissionsTeamId('itneck');
    $role = Role::create([
        'name' => 'reports_only',
        'guard_name' => OrgPermissionCatalog::GUARD,
        config('permission.column_names.team_foreign_key') => 'itneck',
    ]);
    $role->syncPermissions([OrgPermissionCatalog::REPORTS_VIEW]);
    $viewer->syncRoles([$role]);
    setPermissionsTeamId(null);

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets')
        ->assertForbidden();

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/summary')
        ->assertOk();
});

test('groups manager can list targets but not mutate them', function () {
    $manager = app(CreateOrgUser::class)->handle(
        'itneck',
        'Groups Manager',
        'groups.manager@itneck.test',
        'DemoPass!234',
        [],
    );

    setPermissionsTeamId('itneck');
    $role = Role::create([
        'name' => 'groups_only',
        'guard_name' => OrgPermissionCatalog::GUARD,
        config('permission.column_names.team_foreign_key') => 'itneck',
    ]);
    $role->syncPermissions([OrgPermissionCatalog::GROUPS_MANAGE]);
    $manager->syncRoles([$role]);
    setPermissionsTeamId(null);

    $this->actingAs($manager)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets')
        ->assertOk();

    $this->actingAs($manager)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'blocked@itneck.test',
        ])
        ->assertForbidden();
});

test('org admin can manage users and roles', function () {
    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Ops User',
            'email' => 'ops@itneck.test',
            'password' => 'DemoPass!234',
            'roles' => ['org_admin'],
        ])
        ->assertCreated()
        ->assertJsonPath('data.email', 'ops@itneck.test')
        ->assertJsonPath('data.tenant_id', 'itneck')
        ->assertJsonPath('data.roles', ['org_admin']);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/roles', [
            'name' => 'campaign_ops',
            'permissions' => [
                OrgPermissionCatalog::CAMPAIGNS_MANAGE,
                OrgPermissionCatalog::TRAINING_MANAGE,
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'campaign_ops');

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Desk User',
            'email' => 'desk@itneck.test',
            'password' => 'DemoPass!234',
            'roles' => ['sd_user'],
        ])
        ->assertCreated()
        ->assertJsonPath('data.roles', ['sd_user']);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/users/'.$created->json('data.id').'/roles', [
            'roles' => ['sd_admin'],
        ])
        ->assertOk()
        ->assertJsonPath('data.roles', ['sd_admin']);
});

test('only platform staff can access filament panel', function () {
    $platform = platformAdmin();
    $org = orgAdmin();

    expect($platform->canAccessPanel(Filament::getPanel('admin')))->toBeTrue()
        ->and($org->canAccessPanel(Filament::getPanel('admin')))->toBeFalse();
});

test('platform staff can access msp tenants api', function () {
    $this->actingAs(platformAdmin())
        ->getJson('/api/v1/msp/tenants')
        ->assertOk();

    $this->actingAs(orgAdmin())
        ->getJson('/api/v1/msp/tenants')
        ->assertForbidden();
});

test('auth me returns tenant roles and permissions', function () {
    $this->actingAs(orgAdmin())
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'itneck')
        ->assertJsonPath('data.is_platform_staff', false)
        ->assertJsonFragment(['org.users.manage']);
});

test('permission catalog is seeded', function () {
    foreach (OrgPermissionCatalog::all() as $permission) {
        expect(
            Permission::query()->where('name', $permission)->exists()
        )->toBeTrue();
    }

    setPermissionsTeamId('itneck');
    expect(Role::findByName(OrgPermissionCatalog::ORG_ADMIN, OrgPermissionCatalog::GUARD))->not->toBeNull();
    setPermissionsTeamId(null);
});
