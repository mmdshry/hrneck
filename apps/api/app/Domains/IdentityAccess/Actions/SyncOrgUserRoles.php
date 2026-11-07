<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class SyncOrgUserRoles
{
    /**
     * @param  list<string>  $roleNames
     */
    public function handle(User $user, string $tenantId, array $roleNames): User
    {
        if ($user->tenant_id !== $tenantId) {
            throw ValidationException::withMessages([
                'user' => ['User does not belong to this organization.'],
            ]);
        }

        setPermissionsTeamId($tenantId);

        $roles = [];
        foreach ($roleNames as $roleName) {
            if (in_array($roleName, OrgPermissionCatalog::platformRoles(), true)) {
                throw ValidationException::withMessages([
                    'roles' => ['Platform roles cannot be assigned to organization users.'],
                ]);
            }
            $roles[] = Role::findOrCreate($roleName, OrgPermissionCatalog::GUARD);
        }

        $user->syncRoles($roles);

        setPermissionsTeamId(null);

        return $user->fresh(['roles']);
    }
}
