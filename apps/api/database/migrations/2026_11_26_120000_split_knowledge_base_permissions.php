<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Replaces org.ticketing.kb with org.kb.view and org.kb.manage.
 *
 * Every holder of the old permission, whether through a role or directly on a user, receives both new
 * permissions, so nobody loses or gains access. org_admin roles always receive both. The old permission
 * is removed afterwards.
 *
 * Literal names are used on purpose so later catalog changes cannot alter this migration.
 * Grants are data changes and are intentionally not reversed in down().
 */
return new class extends Migration
{
    private const OLD_PERMISSION = 'org.ticketing.kb';

    /** @var list<string> */
    private const NEW_PERMISSIONS = [
        'org.kb.view',
        'org.kb.manage',
    ];

    private const GUARD = 'web';

    private const ORG_ADMIN_ROLE = 'org_admin';

    public function up(): void
    {
        $tables = config('permission.table_names');
        $teamKey = config('permission.column_names.team_foreign_key', 'tenant_id');
        $now = now();

        DB::table($tables['permissions'])->insertOrIgnore(array_map(
            fn (string $name): array => [
                'name' => $name,
                'guard_name' => self::GUARD,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            self::NEW_PERMISSIONS,
        ));

        /** @var array<string, int> $permissionIds */
        $permissionIds = DB::table($tables['permissions'])
            ->where('guard_name', self::GUARD)
            ->whereIn('name', [self::OLD_PERMISSION, ...self::NEW_PERMISSIONS])
            ->pluck('id', 'name')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        $newPermissionIds = array_values(array_intersect_key($permissionIds, array_flip(self::NEW_PERMISSIONS)));
        $oldPermissionId = $permissionIds[self::OLD_PERMISSION] ?? null;

        if ($oldPermissionId !== null) {
            $roleIds = DB::table($tables['role_has_permissions'])
                ->where('permission_id', $oldPermissionId)
                ->pluck('role_id')
                ->map(fn (mixed $id): int => (int) $id)
                ->all();

            $this->grantRoles($tables, $roleIds, $newPermissionIds);
            $this->grantUsers($tables, $oldPermissionId, $newPermissionIds);
        }

        $orgAdminRoleIds = DB::table($tables['roles'])
            ->where('name', self::ORG_ADMIN_ROLE)
            ->where('guard_name', self::GUARD)
            ->whereNotNull($teamKey)
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        $this->grantRoles($tables, $orgAdminRoleIds, $newPermissionIds);

        if ($oldPermissionId !== null) {
            DB::table($tables['role_has_permissions'])->where('permission_id', $oldPermissionId)->delete();
            DB::table($tables['model_has_permissions'])->where('permission_id', $oldPermissionId)->delete();
            DB::table($tables['permissions'])->where('id', $oldPermissionId)->delete();
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Intentionally empty: grants may have been edited since the split.
    }

    /**
     * @param  array<string, string>  $tables
     * @param  list<int>  $roleIds
     * @param  list<int>  $permissionIds
     */
    private function grantRoles(array $tables, array $roleIds, array $permissionIds): void
    {
        $rows = [];
        foreach (array_unique($roleIds) as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $rows[] = ['permission_id' => $permissionId, 'role_id' => $roleId];
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($tables['role_has_permissions'])->insertOrIgnore($chunk);
        }
    }

    /**
     * Copies direct user grants (including the team column when teams are enabled) to the new permissions.
     *
     * @param  array<string, string>  $tables
     * @param  list<int>  $permissionIds
     */
    private function grantUsers(array $tables, int $oldPermissionId, array $permissionIds): void
    {
        $grants = DB::table($tables['model_has_permissions'])
            ->where('permission_id', $oldPermissionId)
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->all();

        $rows = [];
        foreach ($grants as $grant) {
            foreach ($permissionIds as $permissionId) {
                $rows[] = [...$grant, 'permission_id' => $permissionId];
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($tables['model_has_permissions'])->insertOrIgnore($chunk);
        }
    }
};
