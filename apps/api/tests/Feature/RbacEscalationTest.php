<?php

use App\Domains\AnalyticsReporting\Jobs\SendScheduledReportJob;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Realtime\Support\LiveChannelGate;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Ticketing\Models\SdDesk;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Facades\Tenancy;

/**
 * @param  list<string>  $permissions
 */
function rbacCreateRole(string $name, array $permissions): Role
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
function rbacMemberWith(string $email, string $roleName, array $permissions): User
{
    $user = app(CreateOrgUser::class)->handle('itneck', $roleName.' member', $email, 'DemoPass!234', []);
    $role = rbacCreateRole($roleName, $permissions);

    setPermissionsTeamId('itneck');
    $user->syncRoles([$role]);
    setPermissionsTeamId(null);

    return $user;
}

/**
 * Leaves `$keeper` as the only active itneck member holding a role-management permission.
 */
function rbacKeepOnlyRoleManager(User $keeper): void
{
    $roleIds = Role::query()
        ->where(config('permission.column_names.team_foreign_key'), 'itneck')
        ->whereHas('permissions', fn ($query) => $query->where('name', OrgPermissionCatalog::ROLES_MANAGE))
        ->pluck('id');

    DB::connection(config('tenancy.database.central_connection'))
        ->table(config('permission.table_names.model_has_roles'))
        ->whereIn('role_id', $roleIds)
        ->where('model_type', User::class)
        ->where('model_id', '!=', $keeper->id)
        ->delete();
}

/**
 * @return list<string>
 */
function rbacRoleNamesFor(User $user): array
{
    setPermissionsTeamId('itneck');
    $names = $user->fresh()->getRoleNames()->values()->all();
    setPermissionsTeamId(null);

    return $names;
}

function rbacIncidentDeskId(): int
{
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $deskId = (int) SdDesk::query()->where('slug', 'incident')->value('id');
    Tenancy::end();

    return $deskId;
}

test('role admins cannot create a role with permissions they do not hold', function () {
    $admin = rbacMemberWith('roles.admin@itneck.test', 'roles_admin', [
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/roles', [
            'name' => 'escalated',
            'permissions' => [OrgPermissionCatalog::TICKETING_ADMIN],
        ])
        ->assertForbidden();

    setPermissionsTeamId('itneck');
    expect(Role::query()->where('name', 'escalated')->exists())->toBeFalse();
    setPermissionsTeamId(null);
});

test('role admins cannot update a role to add permissions they do not hold', function () {
    $admin = rbacMemberWith('roles.editor@itneck.test', 'roles_editor', [
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);
    $role = rbacCreateRole('desk_helpers', [OrgPermissionCatalog::REPORTS_VIEW]);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/roles/'.$role->id, [
            'permissions' => [OrgPermissionCatalog::REPORTS_VIEW, OrgPermissionCatalog::TICKETING_ADMIN],
        ])
        ->assertForbidden();

    expect($role->fresh('permissions')->permissions->pluck('name')->all())
        ->not->toContain(OrgPermissionCatalog::TICKETING_ADMIN);
});

test('role admins can grant a role whose permissions they hold', function () {
    $admin = rbacMemberWith('campaigns.lead@itneck.test', 'campaigns_lead', [
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::USERS_MANAGE,
        OrgPermissionCatalog::CAMPAIGNS_MANAGE,
    ]);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/roles', [
            'name' => 'campaign_lead_copy',
            'permissions' => [OrgPermissionCatalog::CAMPAIGNS_MANAGE],
        ])
        ->assertCreated();
});

test('role admins cannot assign org_admin or create an org_admin user', function () {
    $admin = rbacMemberWith('partial.admin@itneck.test', 'partial_admin', [
        OrgPermissionCatalog::USERS_MANAGE,
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);
    $target = app(CreateOrgUser::class)->handle('itneck', 'Target', 'target.member@itneck.test', 'DemoPass!234', []);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/users/'.$target->id.'/roles', ['roles' => ['org_admin']])
        ->assertForbidden();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Sneaky Admin',
            'email' => 'sneaky.admin@itneck.test',
            'password' => 'DemoPass!234',
        ])
        ->assertForbidden();

    expect(rbacRoleNamesFor($target))->not->toContain(OrgPermissionCatalog::ORG_ADMIN);
});

test('unknown permission names are rejected when creating a role', function () {
    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/roles', [
            'name' => 'bogus_role',
            'permissions' => ['org.does.not.exist'],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['permissions']);
});

test('the last role manager cannot remove their own role management', function () {
    $manager = rbacMemberWith('last.manager@itneck.test', 'sole_manager', [
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::USERS_MANAGE,
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);
    rbacCreateRole('reports_viewer', [OrgPermissionCatalog::REPORTS_VIEW]);
    rbacKeepOnlyRoleManager($manager);

    $this->actingAs($manager)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/users/'.$manager->id.'/roles', ['roles' => ['reports_viewer']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['roles']);

    expect(rbacRoleNamesFor($manager))->toContain('sole_manager');
});

test('a role manager can step down while another active member still manages roles', function () {
    $manager = rbacMemberWith('co.manager@itneck.test', 'co_manager', [
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::USERS_MANAGE,
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);
    rbacCreateRole('reports_viewer', [OrgPermissionCatalog::REPORTS_VIEW]);

    // The seeded itneck admin still holds org_admin, so another manager exists.
    $this->actingAs($manager)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/users/'.$manager->id.'/roles', ['roles' => ['reports_viewer']])
        ->assertOk();
});

test('the last role manager cannot be deleted', function () {
    $lastManager = rbacMemberWith('deletable.manager@itneck.test', 'deletable_manager', [
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::USERS_MANAGE,
    ]);
    $usersAdmin = rbacMemberWith('users.only@itneck.test', 'users_only', [
        OrgPermissionCatalog::USERS_MANAGE,
    ]);
    rbacKeepOnlyRoleManager($lastManager);

    $this->actingAs($usersAdmin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/users/'.$lastManager->id)
        ->assertUnprocessable();

    expect(User::query()->whereKey($lastManager->id)->exists())->toBeTrue();
});

test('the only role-management permission cannot be removed from its role', function () {
    $manager = rbacMemberWith('role.holder@itneck.test', 'sole_roles_manager', [
        OrgPermissionCatalog::ROLES_MANAGE,
        OrgPermissionCatalog::USERS_MANAGE,
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);
    rbacKeepOnlyRoleManager($manager);
    $role = Role::query()
        ->where(config('permission.column_names.team_foreign_key'), 'itneck')
        ->where('name', 'sole_roles_manager')
        ->firstOrFail();

    $this->actingAs($manager)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/roles/'.$role->id, [
            'permissions' => [OrgPermissionCatalog::USERS_MANAGE, OrgPermissionCatalog::REPORTS_VIEW],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['permissions']);

    expect($role->fresh('permissions')->permissions->pluck('name')->all())
        ->toContain(OrgPermissionCatalog::ROLES_MANAGE);
});

test('role names must be unique within the organization', function () {
    $alpha = rbacCreateRole('alpha_team', [OrgPermissionCatalog::REPORTS_VIEW]);
    $beta = rbacCreateRole('beta_team', [OrgPermissionCatalog::REPORTS_VIEW]);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/roles/'.$beta->id, [
            'name' => $alpha->name,
            'permissions' => [OrgPermissionCatalog::REPORTS_VIEW],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);
});

test('ticketing users without view-all only see tickets they requested', function () {
    $requester = rbacMemberWith('desk.requester@itneck.test', 'desk_requester', [
        OrgPermissionCatalog::TICKETING_TICKETS,
    ]);
    $deskId = rbacIncidentDeskId();

    $adminTicket = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'Admin-only ticket',
        ])
        ->assertCreated()
        ->json('data.id');

    $ownTicket = $this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'My ticket',
        ])
        ->assertCreated()
        ->json('data.id');

    $listedIds = collect($this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets?per_page=50')
        ->assertOk()
        ->json('data'))->pluck('id')->all();

    expect($listedIds)->toContain($ownTicket)
        ->and($listedIds)->not->toContain($adminTicket);

    $this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets/'.$adminTicket)
        ->assertNotFound();

    $this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/ticketing/tickets/'.$adminTicket, ['summary' => 'Hijacked'])
        ->assertNotFound();

    $this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/tickets/'.$adminTicket.'/notes', ['body' => 'Sneaky note'])
        ->assertNotFound();

    $this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/tickets/bulk', [
            'action' => 'archive',
            'ids' => [$adminTicket],
        ])
        ->assertNotFound();

    $this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets/'.$ownTicket)
        ->assertOk();
});

test('org admins with view-all can open tickets requested by scoped users', function () {
    $deskId = rbacIncidentDeskId();
    $requester = rbacMemberWith('scoped.requester@itneck.test', 'scoped_requester', [
        OrgPermissionCatalog::TICKETING_TICKETS,
    ]);

    $ticket = $this->actingAs($requester)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'Requested by a scoped user',
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets/'.$ticket)
        ->assertOk();
});

test('the built-in sd_user preset is requester scoped', function () {
    expect(OrgPermissionCatalog::ticketingRolePermissions()[OrgPermissionCatalog::SD_USER])
        ->not->toContain(OrgPermissionCatalog::TICKETING_VIEW_ALL)
        ->and(OrgPermissionCatalog::ticketingRolePermissions()[OrgPermissionCatalog::SD_ADMIN])
        ->toContain(OrgPermissionCatalog::TICKETING_VIEW_ALL);
});

test('users without view-all do not get the org-wide tickets live feed', function () {
    $requester = rbacMemberWith('live.requester@itneck.test', 'live_requester', [
        OrgPermissionCatalog::TICKETING_TICKETS,
    ]);
    $gate = app(LiveChannelGate::class);

    expect($gate->allowsOrgTopic($requester, 'itneck', LiveTopics::TICKETS))->toBeFalse()
        ->and($gate->allowsOrgTopic(orgAdmin('itneck'), 'itneck', LiveTopics::TICKETS))->toBeTrue();
});

test('only export holders can email reports and only to members with report access', function () {
    Bus::fake();

    $viewer = rbacMemberWith('report.viewer@itneck.test', 'report_viewer', [
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);
    $exporter = rbacMemberWith('report.exporter@itneck.test', 'report_exporter', [
        OrgPermissionCatalog::REPORTS_VIEW,
        OrgPermissionCatalog::REPORTS_EXPORT,
    ]);
    $plainMember = rbacMemberWith('report.plain@itneck.test', 'report_plain', [
        OrgPermissionCatalog::USERS_VIEW,
    ]);

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/email', ['recipient_user_ids' => [$exporter->id]])
        ->assertForbidden();

    $this->actingAs($exporter)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/email', ['recipient_user_ids' => [$plainMember->id]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['recipient_user_ids']);

    $this->actingAs($exporter)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/email', ['recipient_user_ids' => [$exporter->id]])
        ->assertOk()
        ->assertJson(['queued' => true]);

    Bus::assertDispatched(SendScheduledReportJob::class, 1);
});
