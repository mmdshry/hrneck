<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Guards org role and permission changes made through the API:
 * - an actor can only grant permissions it already holds (no privilege escalation);
 * - a tenant always keeps at least one active member who can manage roles.
 */
final class OrgRoleChangeGuard
{
    /**
     * Baseline role for employees. It only unlocks the employee's own portal, so it is
     * assignable without holding the portal permission itself.
     */
    private const BASELINE_ROLES = [OrgPermissionCatalog::LEARNER];

    /**
     * Roles the user holds in the tenant, read from the pivot so other tenants never leak in.
     *
     * @return list<string>
     */
    public function currentRoleNames(User $user, string $tenantId): array
    {
        return $this->tenantRolesQuery($tenantId)
            ->join('model_has_roles', 'model_has_roles.role_id', '=', 'roles.id')
            ->where('model_has_roles.model_type', User::class)
            ->where('model_has_roles.model_id', $user->id)
            ->orderBy('roles.name')
            ->pluck('roles.name')
            ->values()
            ->all();
    }

    /**
     * Roles newly added by this request must only carry permissions the actor already holds.
     *
     * @param  list<string>  $requestedRoleNames
     * @param  list<string>  $currentRoleNames
     */
    public function assertCanGrantRoles(User $actor, string $tenantId, array $requestedRoleNames, array $currentRoleNames = []): void
    {
        $added = array_values(array_diff($requestedRoleNames, $currentRoleNames, self::BASELINE_ROLES));
        if ($added === []) {
            return;
        }

        $permissions = $this->tenantRolesQuery($tenantId)
            ->whereIn('roles.name', $added)
            ->get()
            ->flatMap(fn (Role $role): array => $role->permissions->pluck('name')->all())
            ->unique()
            ->values()
            ->all();

        if (in_array(OrgPermissionCatalog::ORG_ADMIN, $added, true)) {
            // ensureOrgAdminRole re-syncs org_admin to the full catalog, even when the row is missing.
            $permissions = [...$permissions, ...OrgPermissionCatalog::all()];
        }

        $this->assertActorHoldsPermissions($actor, $permissions);
    }

    /**
     * @param  list<string>  $requestedPermissionNames
     * @param  list<string>  $currentPermissionNames
     */
    public function assertCanGrantPermissions(User $actor, array $requestedPermissionNames, array $currentPermissionNames = []): void
    {
        $unknown = array_diff($requestedPermissionNames, OrgPermissionCatalog::all());
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'permissions' => ['Unknown permissions: '.implode(', ', $unknown)],
            ]);
        }

        $added = array_values(array_diff($requestedPermissionNames, $currentPermissionNames));

        $this->assertActorHoldsPermissions($actor, $added);
    }

    /**
     * Rejects a change that would leave no other active member with role management.
     *
     * @param  list<string>  $newRoleNames  the roles the user holds after the change
     */
    public function assertRolesManagementRemainsForUser(string $tenantId, User $user, array $newRoleNames): void
    {
        $holders = $this->rolesManagerUserIds($tenantId);
        if (! $holders->contains((int) $user->id)) {
            return;
        }

        if ($this->roleNamesGrantRolesManagement($tenantId, $newRoleNames)) {
            return;
        }

        if ($holders->reject(fn (int $id): bool => $id === (int) $user->id)->isEmpty()) {
            throw ValidationException::withMessages([
                'roles' => ['At least one active member must keep role management.'],
            ]);
        }
    }

    /**
     * Rejects a role change or deletion that would leave no active member with role management.
     *
     * @param  list<string>  $newPermissionNames  permissions the role keeps (empty when deleting)
     */
    public function assertRolesManagementRemainsForRole(string $tenantId, Role $role, array $newPermissionNames): void
    {
        $role->loadMissing('permissions');
        $currentlyGrants = $role->permissions->contains('name', OrgPermissionCatalog::ROLES_MANAGE);
        if (! $currentlyGrants || in_array(OrgPermissionCatalog::ROLES_MANAGE, $newPermissionNames, true)) {
            return;
        }

        if ($this->rolesManagerUserIds($tenantId, excludingRoleId: (int) $role->id)->isEmpty()) {
            throw ValidationException::withMessages([
                'permissions' => ['At least one active member must keep role management.'],
            ]);
        }
    }

    /**
     * @param  list<string>  $permissions
     */
    private function assertActorHoldsPermissions(User $actor, array $permissions): void
    {
        $missing = array_values(array_filter(
            $permissions,
            fn (string $permission): bool => ! $actor->can($permission),
        ));

        if ($missing !== []) {
            throw new AuthorizationException(
                'You cannot grant permissions you do not hold: '.implode(', ', $missing).'.',
            );
        }
    }

    /**
     * @param  list<string>  $roleNames
     */
    private function roleNamesGrantRolesManagement(string $tenantId, array $roleNames): bool
    {
        if ($roleNames === []) {
            return false;
        }

        return Role::query()
            ->where(config('permission.column_names.team_foreign_key'), $tenantId)
            ->whereIn('name', $roleNames)
            ->whereHas('permissions', fn ($query) => $query->where('name', OrgPermissionCatalog::ROLES_MANAGE))
            ->exists();
    }

    /**
     * Active tenant members who hold a role granting role management, optionally ignoring one role.
     *
     * @return Collection<int, int>
     */
    private function rolesManagerUserIds(string $tenantId, ?int $excludingRoleId = null): Collection
    {
        // Spatie pivot tables live on the central connection, even while a tenant is initialized.
        $candidateIds = DB::connection(config('tenancy.database.central_connection'))
            ->table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->join('role_has_permissions', 'role_has_permissions.role_id', '=', 'roles.id')
            ->join('permissions', 'permissions.id', '=', 'role_has_permissions.permission_id')
            ->where('model_has_roles.model_type', User::class)
            ->where('roles.'.config('permission.column_names.team_foreign_key'), $tenantId)
            ->where('permissions.name', OrgPermissionCatalog::ROLES_MANAGE)
            ->where('permissions.guard_name', OrgPermissionCatalog::GUARD)
            ->when($excludingRoleId !== null, fn ($query) => $query->where('roles.id', '!=', $excludingRoleId))
            ->distinct()
            ->pluck('model_has_roles.model_id')
            ->map(fn ($id): int => (int) $id)
            ->values();

        if ($candidateIds->isEmpty()) {
            return collect();
        }

        return User::query()
            ->inTenant($tenantId)
            ->whereNull('disabled_at')
            ->whereIn('id', $candidateIds)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->values();
    }

    /**
     * @return Builder<Role>
     */
    private function tenantRolesQuery(string $tenantId): Builder
    {
        return Role::query()
            ->where('roles.'.config('permission.column_names.team_foreign_key'), $tenantId)
            ->where('roles.guard_name', OrgPermissionCatalog::GUARD);
    }
}
