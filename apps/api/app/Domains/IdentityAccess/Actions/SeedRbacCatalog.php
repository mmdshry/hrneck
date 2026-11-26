<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use LogicException;
use Spatie\Permission\PermissionRegistrar;

class SeedRbacCatalog
{
    public function handle(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        setPermissionsTeamId(null);

        foreach (OrgPermissionCatalog::all() as $name) {
            Permission::findOrCreate($name, OrgPermissionCatalog::GUARD);
        }

        foreach ([
            OrgPermissionCatalog::PLATFORM_SUPER_ADMIN,
            OrgPermissionCatalog::PLATFORM_AGENT,
        ] as $roleName) {
            Role::findOrCreate($roleName, OrgPermissionCatalog::GUARD);
        }

        // Reserved global learner name (no team): keep empty. Tenant-scoped learner
        // with org.ticketing.portal is created via ensureLearnerRole().
        $globalLearner = Role::findOrCreate(OrgPermissionCatalog::LEARNER, OrgPermissionCatalog::GUARD);
        $globalLearner->syncPermissions([]);

        // Migrate legacy global role names if present.
        $this->renameLegacyRole(OrgPermissionCatalog::LEGACY_PARTNER_ADMIN, OrgPermissionCatalog::PLATFORM_SUPER_ADMIN);
        $this->renameLegacyRole(OrgPermissionCatalog::LEGACY_PARTNER_AGENT, OrgPermissionCatalog::PLATFORM_AGENT);
        $this->deleteLegacyGlobalRole(OrgPermissionCatalog::LEGACY_CLIENT_ADMIN);
    }

    public function ensureOrgAdminRole(string $tenantId): Role
    {
        // Permissions are global (name+guard unique); create them outside a team context.
        setPermissionsTeamId(null);
        foreach (OrgPermissionCatalog::all() as $name) {
            if (! Permission::query()
                ->where('name', $name)
                ->where('guard_name', OrgPermissionCatalog::GUARD)
                ->exists()) {
                Permission::query()->create([
                    'name' => $name,
                    'guard_name' => OrgPermissionCatalog::GUARD,
                ]);
            }
        }
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        setPermissionsTeamId($tenantId);

        $role = Role::findOrCreate(OrgPermissionCatalog::ORG_ADMIN, OrgPermissionCatalog::GUARD);
        $role->syncPermissions(OrgPermissionCatalog::all());

        foreach (OrgPermissionCatalog::ticketingRolePermissions() as $roleName => $permissions) {
            $sdRole = Role::findOrCreate($roleName, OrgPermissionCatalog::GUARD);
            $sdRole->syncPermissions($permissions);
        }

        $this->ensureLearnerRole($tenantId);

        setPermissionsTeamId(null);

        return $role;
    }

    /**
     * Creates the starter roles for an organization that does not have them yet.
     * Create-only: an existing role keeps whatever permissions its admins chose.
     */
    public function ensureTemplateRoles(string $tenantId): void
    {
        setPermissionsTeamId(null);
        foreach (OrgPermissionCatalog::all() as $name) {
            Permission::findOrCreate($name, OrgPermissionCatalog::GUARD);
        }
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        setPermissionsTeamId($tenantId);
        foreach (OrgPermissionCatalog::templateRolePermissions() as $name => $permissions) {
            $exists = Role::query()
                ->where(config('permission.column_names.team_foreign_key'), $tenantId)
                ->where('name', $name)
                ->where('guard_name', OrgPermissionCatalog::GUARD)
                ->exists();

            if ($exists) {
                continue;
            }

            $role = Role::create([
                'name' => $name,
                'guard_name' => OrgPermissionCatalog::GUARD,
                config('permission.column_names.team_foreign_key') => $tenantId,
            ]);
            $role->syncPermissions($permissions);
        }
        setPermissionsTeamId(null);
    }

    public function ensureLearnerRole(string $tenantId): Role
    {
        setPermissionsTeamId(null);
        Permission::findOrCreate(OrgPermissionCatalog::TICKETING_PORTAL, OrgPermissionCatalog::GUARD);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        setPermissionsTeamId($tenantId);
        $role = Role::findOrCreate(OrgPermissionCatalog::LEARNER, OrgPermissionCatalog::GUARD);
        if (! $role instanceof Role) {
            throw new LogicException('Expected '.Role::class.' for the learner role.');
        }
        $role->syncPermissions([OrgPermissionCatalog::TICKETING_PORTAL]);
        setPermissionsTeamId(null);

        return $role;
    }

    private function renameLegacyRole(string $from, string $to): void
    {
        $teamKey = config('permission.column_names.team_foreign_key');
        $legacy = Role::query()
            ->where('name', $from)
            ->where('guard_name', OrgPermissionCatalog::GUARD)
            ->whereNull($teamKey)
            ->first();

        if (! $legacy) {
            return;
        }

        $target = Role::findOrCreate($to, OrgPermissionCatalog::GUARD);

        foreach ($legacy->users as $user) {
            if (! $user instanceof User) {
                continue;
            }
            $teamId = $user->resolvedActiveTenantId() ?? $user->tenant_id;
            setPermissionsTeamId($teamId);
            $user->assignRole($target);
            $user->removeRole($legacy);
        }

        setPermissionsTeamId(null);
        $legacy->delete();
    }

    private function deleteLegacyGlobalRole(string $name): void
    {
        $teamKey = config('permission.column_names.team_foreign_key');
        Role::query()
            ->where('name', $name)
            ->where('guard_name', OrgPermissionCatalog::GUARD)
            ->whereNull($teamKey)
            ->delete();
    }
}
