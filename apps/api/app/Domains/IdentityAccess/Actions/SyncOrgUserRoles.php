<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Facades\Tenancy;

class SyncOrgUserRoles
{
    public function __construct(
        private readonly SeedRbacCatalog $rbac,
        private readonly ProvisionEmployeePair $provision,
    ) {}

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

        if (in_array(OrgPermissionCatalog::LEARNER, $roleNames, true)) {
            $this->rbac->ensureLearnerRole($tenantId);
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

        if (in_array(OrgPermissionCatalog::LEARNER, $roleNames, true)) {
            $was = tenant('id');
            if ($was !== $tenantId) {
                $tenant = Tenant::query()->find($tenantId);
                if ($tenant) {
                    Tenancy::initialize($tenant);
                }
            }
            try {
                $this->provision->ensureTargetForLearner($user);
            } finally {
                if ($was !== $tenantId) {
                    Tenancy::end();
                }
            }
        }

        return $user->fresh(['roles']);
    }
}
