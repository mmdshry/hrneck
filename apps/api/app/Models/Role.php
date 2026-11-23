<?php

namespace App\Models;

use Spatie\Permission\Contracts\Role as RoleContract;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Role extends SpatieRole
{
    use CentralConnection;

    /**
     * Spatie's default teams lookup matches null-team OR current-team roles, so a
     * global "learner" would be reused across tenants and collide on model_has_roles
     * (team key is intentionally outside the PK for MySQL null platform rows).
     * Exact team match keeps org roles tenant-scoped.
     *
     * @param  array<string, mixed>  $params
     */
    protected static function findByParam(array $params = []): ?RoleContract
    {
        $query = static::query();
        $registrar = app(PermissionRegistrar::class);

        if ($registrar->teams) {
            $teamsKey = $registrar->teamsKey;
            $teamId = $params[$teamsKey] ?? getPermissionsTeamId();
            unset($params[$teamsKey]);

            if ($teamId === null || $teamId === '') {
                $query->whereNull($teamsKey);
            } else {
                $query->where($teamsKey, $teamId);
            }
        }

        foreach ($params as $key => $value) {
            $query->where($key, $value);
        }

        return $query->first();
    }
}
