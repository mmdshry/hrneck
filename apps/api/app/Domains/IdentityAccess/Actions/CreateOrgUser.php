<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
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
    ): User {
        $email = $this->provision->normalizeEmail($email);

        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw ValidationException::withMessages([
                'email' => ['A user with this email already exists.'],
            ]);
        }

        $this->rbac->ensureOrgAdminRole($tenantId);

        if (in_array(OrgPermissionCatalog::LEARNER, $roleNames, true)) {
            $this->rbac->ensureLearnerRole($tenantId);
        }

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'tenant_id' => $tenantId,
            'must_set_password' => false,
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        setPermissionsTeamId($tenantId);

        $roles = [];
        foreach ($roleNames as $roleName) {
            $roles[] = Role::findOrCreate($roleName, OrgPermissionCatalog::GUARD);
        }
        $user->syncRoles($roles);

        setPermissionsTeamId(null);

        if (in_array(OrgPermissionCatalog::LEARNER, $roleNames, true)) {
            $this->withTenant($tenantId, function () use ($user): void {
                $this->provision->ensureTargetForLearner($user);
            });
        }

        return $user->load('roles');
    }

    private function withTenant(string $tenantId, callable $callback): void
    {
        $was = tenant('id');
        $tenant = Tenant::query()->find($tenantId);
        if ($tenant === null) {
            return;
        }

        if ($was !== $tenantId) {
            Tenancy::initialize($tenant);
        }

        try {
            $callback();
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
