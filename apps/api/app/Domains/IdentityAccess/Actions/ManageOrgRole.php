<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ManageOrgRole
{
    /**
     * @return Collection<int, Role>
     */
    public function list(string $tenantId): Collection
    {
        setPermissionsTeamId($tenantId);

        $roles = Role::query()
            ->where(config('permission.column_names.team_foreign_key'), $tenantId)
            ->with('permissions')
            ->orderBy('name')
            ->get();

        setPermissionsTeamId(null);

        return $roles;
    }

    /**
     * @param  list<string>  $permissionNames
     */
    public function create(string $tenantId, string $name, array $permissionNames): Role
    {
        $this->assertNotReserved($name);
        $this->assertKnownPermissions($permissionNames);

        setPermissionsTeamId($tenantId);

        if (Role::query()
            ->where(config('permission.column_names.team_foreign_key'), $tenantId)
            ->where('name', $name)
            ->exists()) {
            setPermissionsTeamId(null);
            throw ValidationException::withMessages([
                'name' => ['A role with this name already exists in the organization.'],
            ]);
        }

        $role = Role::create([
            'name' => $name,
            'guard_name' => OrgPermissionCatalog::GUARD,
            config('permission.column_names.team_foreign_key') => $tenantId,
        ]);
        $role->syncPermissions($permissionNames);

        setPermissionsTeamId(null);

        return $role->load('permissions');
    }

    /**
     * @param  list<string>  $permissionNames
     */
    public function update(string $tenantId, Role $role, ?string $name, array $permissionNames): Role
    {
        $this->assertRoleInTenant($role, $tenantId);

        if ($role->name === OrgPermissionCatalog::ORG_ADMIN && $name !== null && $name !== $role->name) {
            throw ValidationException::withMessages([
                'name' => ['The org_admin role cannot be renamed.'],
            ]);
        }

        if ($name !== null) {
            $this->assertNotReserved($name, $role->id);
        }

        $this->assertKnownPermissions($permissionNames);

        setPermissionsTeamId($tenantId);

        if ($name !== null) {
            $role->name = $name;
            $role->save();
        }

        $role->syncPermissions($permissionNames);

        setPermissionsTeamId(null);

        return $role->fresh('permissions');
    }

    public function delete(string $tenantId, Role $role): void
    {
        $this->assertRoleInTenant($role, $tenantId);

        if ($role->name === OrgPermissionCatalog::ORG_ADMIN) {
            throw ValidationException::withMessages([
                'role' => ['The org_admin role cannot be deleted.'],
            ]);
        }

        setPermissionsTeamId($tenantId);
        $role->delete();
        setPermissionsTeamId(null);
    }

    private function assertRoleInTenant(Role $role, string $tenantId): void
    {
        $teamKey = config('permission.column_names.team_foreign_key');
        if ($role->{$teamKey} !== $tenantId) {
            throw ValidationException::withMessages([
                'role' => ['Role does not belong to this organization.'],
            ]);
        }
    }

    private function assertNotReserved(string $name, ?int $ignoreId = null): void
    {
        $reserved = [
            ...OrgPermissionCatalog::platformRoles(),
            OrgPermissionCatalog::LEARNER,
            OrgPermissionCatalog::LEGACY_PARTNER_ADMIN,
            OrgPermissionCatalog::LEGACY_PARTNER_AGENT,
            OrgPermissionCatalog::LEGACY_CLIENT_ADMIN,
        ];

        if (in_array($name, $reserved, true)) {
            throw ValidationException::withMessages([
                'name' => ['This role name is reserved.'],
            ]);
        }

        if ($ignoreId === null && $name === OrgPermissionCatalog::ORG_ADMIN) {
            // Creating another org_admin via custom create is blocked; use ensure seed instead.
            // Allow sync of existing org_admin via update path only.
        }
    }

    /**
     * @param  list<string>  $permissionNames
     */
    private function assertKnownPermissions(array $permissionNames): void
    {
        $unknown = array_diff($permissionNames, OrgPermissionCatalog::all());
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'permissions' => ['Unknown permissions: '.implode(', ', $unknown)],
            ]);
        }

        foreach ($permissionNames as $permissionName) {
            Permission::findOrCreate($permissionName, OrgPermissionCatalog::GUARD);
        }
    }
}
