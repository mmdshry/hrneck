<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Role names each account holds in one organization, read in one query from the central role pivot
 * so roles granted in other organizations never leak in.
 */
final class ListAccountRoleNames
{
    /**
     * @param  list<int>  $userIds
     * @return array<int, list<string>> role names keyed by user id
     */
    public function handle(array $userIds, string $tenantId): array
    {
        if ($userIds === []) {
            return [];
        }

        $rows = DB::connection(config('tenancy.database.central_connection'))
            ->table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_has_roles.model_type', User::class)
            ->whereIn('model_has_roles.model_id', $userIds)
            ->where('roles.'.config('permission.column_names.team_foreign_key'), $tenantId)
            ->orderBy('roles.name')
            ->get(['model_has_roles.model_id', 'roles.name']);

        $rolesByUser = [];
        foreach ($rows as $row) {
            $rolesByUser[(int) $row->model_id][] = (string) $row->name;
        }

        return $rolesByUser;
    }
}
