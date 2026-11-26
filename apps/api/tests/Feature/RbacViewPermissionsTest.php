<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\SeedRbacCatalog;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Realtime\Support\LiveTopics;
use App\Models\Role;
use App\Models\User;

/**
 * @param  list<string>  $permissions
 */
function rbacViewerRole(string $name, array $permissions): Role
{
    setPermissionsTeamId('itneck');
    $role = Role::create([
        'name' => $name,
        'guard_name' => OrgPermissionCatalog::GUARD,
        config('permission.column_names.team_foreign_key') => 'itneck',
    ]);
    $role->syncPermissions($permissions);
    setPermissionsTeamId(null);

    return $role;
}

/**
 * Creates an itneck member whose only access comes from one custom role.
 *
 * @param  list<string>  $permissions
 */
function rbacViewerWith(string $email, string $roleName, array $permissions): User
{
    $user = app(CreateOrgUser::class)->handle('itneck', $roleName.' member', $email, 'DemoPass!234', []);
    $role = rbacViewerRole($roleName, $permissions);

    setPermissionsTeamId('itneck');
    $user->syncRoles([$role]);
    setPermissionsTeamId(null);

    return $user;
}

test('view-only members can read the user list but cannot change users', function () {
    $viewer = rbacViewerWith('users.viewer@itneck.test', 'users_viewer', [OrgPermissionCatalog::USERS_VIEW]);

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/users')
        ->assertOk();

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [])
        ->assertForbidden();
});

test('settings view permission reads settings but cannot save them', function () {
    $viewer = rbacViewerWith('settings.viewer@itneck.test', 'settings_viewer', [OrgPermissionCatalog::SETTINGS_VIEW]);

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/settings')
        ->assertOk();

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/settings', [])
        ->assertForbidden();
});

test('audit log requires the audit view permission', function () {
    $outsider = rbacViewerWith('no.audit@itneck.test', 'no_audit', [OrgPermissionCatalog::REPORTS_VIEW]);
    $auditor = rbacViewerWith('audit.reader@itneck.test', 'audit_reader', [OrgPermissionCatalog::AUDIT_VIEW]);

    $this->actingAs($outsider)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit')
        ->assertForbidden();

    $this->actingAs($auditor)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit')
        ->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
});

test('checklist fillers can open instances but not templates', function () {
    $filler = rbacViewerWith('checklist.filler@itneck.test', 'checklist_filler', [OrgPermissionCatalog::CHECKLISTS_FILL]);

    $this->actingAs($filler)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/checklists/instances')
        ->assertOk();

    $this->actingAs($filler)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/checklists/templates')
        ->assertForbidden();
});

test('hr manager starter role opens checklist instances but cannot create templates', function () {
    app(SeedRbacCatalog::class)->ensureTemplateRoles('itneck');
    $hrManager = app(CreateOrgUser::class)->handle('itneck', 'HR starter', 'hr.starter@itneck.test', 'DemoPass!234', []);

    setPermissionsTeamId('itneck');
    $hrManager->assignRole('hr_manager');
    setPermissionsTeamId(null);

    $this->actingAs($hrManager)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/checklists/instances')
        ->assertOk();

    $this->actingAs($hrManager)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/checklists/templates', [])
        ->assertForbidden();
});

test('template roles are seeded once and never overwritten', function () {
    app(SeedRbacCatalog::class)->ensureTemplateRoles('itneck');

    setPermissionsTeamId('itneck');
    $auditor = Role::query()
        ->where(config('permission.column_names.team_foreign_key'), 'itneck')
        ->where('name', 'auditor')
        ->firstOrFail();
    expect($auditor->permissions->pluck('name')->all())->toContain(OrgPermissionCatalog::AUDIT_VIEW);

    $auditor->syncPermissions([OrgPermissionCatalog::REPORTS_VIEW]);
    setPermissionsTeamId(null);

    app(SeedRbacCatalog::class)->ensureTemplateRoles('itneck');

    setPermissionsTeamId('itneck');
    expect($auditor->fresh('permissions')->permissions->pluck('name')->all())
        ->toBe([OrgPermissionCatalog::REPORTS_VIEW]);
    setPermissionsTeamId(null);
});

test('live users topic accepts either users permission', function () {
    expect(LiveTopics::permissionsFor(LiveTopics::USERS))
        ->toContain(OrgPermissionCatalog::USERS_VIEW)
        ->toContain(OrgPermissionCatalog::USERS_MANAGE);
});
