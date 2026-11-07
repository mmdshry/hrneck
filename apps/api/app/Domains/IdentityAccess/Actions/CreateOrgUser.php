<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CreateOrgUser
{
    public function __construct(private readonly SeedRbacCatalog $rbac) {}

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
        if (User::query()->where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['A user with this email already exists.'],
            ]);
        }

        $this->rbac->ensureOrgAdminRole($tenantId);

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'tenant_id' => $tenantId,
            'mfa_enabled' => false,
        ]);

        setPermissionsTeamId($tenantId);

        $roles = [];
        foreach ($roleNames as $roleName) {
            $roles[] = Role::findOrCreate($roleName, OrgPermissionCatalog::GUARD);
        }
        $user->syncRoles($roles);

        setPermissionsTeamId(null);

        return $user->load('roles');
    }
}
