<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Support\ResolveDepartmentFields;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Facades\Tenancy;

class CreateOrgUser
{
    public function __construct(
        private readonly SeedRbacCatalog $rbac,
        private readonly ProvisionEmployeePair $provision,
        private readonly EnsureTenantMembership $memberships,
    ) {}

    /**
     * @param  list<string>  $roleNames
     */
    public function handle(
        string $tenantId,
        string $name,
        string $email,
        string $password,
        array $roleNames = [OrgPermissionCatalog::ORG_ADMIN],
        mixed $departmentId = null,
        bool $hasDepartmentId = false,
    ): User {
        $email = $this->provision->normalizeEmail($email);

        $existing = $this->provision->findUserByEmail($email);
        if ($existing !== null) {
            if ($existing->isPlatformStaff()) {
                throw ValidationException::withMessages([
                    'email' => ['This email belongs to a platform staff account and cannot be linked to an organization.'],
                ]);
            }

            if ($existing->belongsToTenant($tenantId, activeOnly: false)) {
                throw ValidationException::withMessages([
                    'email' => ['A user with this email already belongs to this organization.'],
                ]);
            }
        }

        $this->rbac->ensureOrgAdminRole($tenantId);

        if (in_array(OrgPermissionCatalog::LEARNER, $roleNames, true)) {
            $this->rbac->ensureLearnerRole($tenantId);
        }

        $departmentFields = ['department_id' => null, 'department' => null];
        if ($hasDepartmentId) {
            $departmentFields = $this->withTenant($tenantId, function () use ($departmentId): array {
                return app(ResolveDepartmentFields::class)->fromId($departmentId);
            }) ?? $departmentFields;
        }

        if ($existing === null) {
            $user = User::query()->create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'tenant_id' => $tenantId,
                'department_id' => $departmentFields['department_id'],
                'department' => $departmentFields['department'],
                'must_set_password' => false,
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();
        } else {
            $user = $existing;
            $user->forceFill([
                'name' => $name !== '' ? $name : $user->name,
                'disabled_at' => null,
            ])->save();
        }

        $this->memberships->handle($user, $tenantId, $departmentFields);

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
            $this->withTenant($tenantId, function () use ($user, $tenantId): void {
                $this->provision->ensureTargetForLearner($user, $tenantId);
            });
        }

        return $user->load(['roles', 'memberships.tenant']);
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T|null
     */
    private function withTenant(string $tenantId, callable $callback): mixed
    {
        $was = tenant('id');
        $tenant = Tenant::query()->find($tenantId);
        if ($tenant === null) {
            return null;
        }

        if ($was !== $tenantId) {
            Tenancy::initialize($tenant);
        }

        try {
            return $callback();
        } finally {
            if ($was !== $tenantId) {
                if (is_string($was) && $was !== '') {
                    $previous = Tenant::query()->find($was);
                    if ($previous) {
                        Tenancy::initialize($previous);
                    } else {
                        Tenancy::end();
                    }
                } else {
                    Tenancy::end();
                }
            }
        }
    }
}
