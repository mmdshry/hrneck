<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Gives every existing hr_manager role the checklist view and fill permissions.
 * Roles are never created or renamed here, so an organization that edited its role keeps its other permissions.
 *
 * Literal names are used on purpose so later catalog changes cannot alter this migration.
 * Grants are data changes and are intentionally not reversed in down().
 */
return new class extends Migration
{
    /** @var list<string> */
    private const PERMISSIONS = [
        'org.checklists.view',
        'org.checklists.fill',
    ];

    public function up(): void
    {
        $tables = config('permission.table_names');
        $teamKey = config('permission.column_names.team_foreign_key', 'tenant_id');
        $guard = 'web';

        $permissionIds = DB::table($tables['permissions'])
            ->where('guard_name', $guard)
            ->whereIn('name', self::PERMISSIONS)
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        $hrManagerRoleIds = DB::table($tables['roles'])
            ->where('name', 'hr_manager')
            ->where('guard_name', $guard)
            ->whereNotNull($teamKey)
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        $rows = [];
        foreach ($hrManagerRoleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $rows[] = ['permission_id' => $permissionId, 'role_id' => $roleId];
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($tables['role_has_permissions'])->insertOrIgnore($chunk);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Intentionally empty: grants may have been edited since.
    }
};
