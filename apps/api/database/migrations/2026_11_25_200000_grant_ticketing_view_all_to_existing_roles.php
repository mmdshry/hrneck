<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Introduces org.ticketing.view_all. Every role that already had org.ticketing.tickets keeps
 * seeing all tickets, except the sd_user preset, which becomes requester/assignee-scoped.
 *
 * Literal names are used on purpose so later catalog changes cannot alter this migration.
 */
return new class extends Migration
{
    private const PERMISSION = 'org.ticketing.view_all';

    private const TICKETS_PERMISSION = 'org.ticketing.tickets';

    private const SCOPED_ROLE = 'sd_user';

    public function up(): void
    {
        $tables = config('permission.table_names');
        $guard = 'web';
        $now = now();

        DB::table($tables['permissions'])->insertOrIgnore([
            'name' => self::PERMISSION,
            'guard_name' => $guard,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $permissionId = (int) DB::table($tables['permissions'])
            ->where('name', self::PERMISSION)
            ->where('guard_name', $guard)
            ->value('id');

        $ticketsPermissionId = (int) DB::table($tables['permissions'])
            ->where('name', self::TICKETS_PERMISSION)
            ->where('guard_name', $guard)
            ->value('id');

        if ($permissionId === 0 || $ticketsPermissionId === 0) {
            return;
        }

        $roleIds = DB::table($tables['role_has_permissions'].' as rhp')
            ->join($tables['roles'].' as r', 'r.id', '=', 'rhp.role_id')
            ->where('rhp.permission_id', $ticketsPermissionId)
            ->where('r.name', '!=', self::SCOPED_ROLE)
            ->distinct()
            ->pluck('rhp.role_id')
            ->map(fn (mixed $roleId): int => (int) $roleId)
            ->all();

        $rows = array_map(
            fn (int $roleId): array => ['permission_id' => $permissionId, 'role_id' => $roleId],
            $roleIds,
        );

        if ($rows !== []) {
            DB::table($tables['role_has_permissions'])->insertOrIgnore($rows);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $tables = config('permission.table_names');

        $permissionId = DB::table($tables['permissions'])
            ->where('name', self::PERMISSION)
            ->where('guard_name', 'web')
            ->value('id');

        if ($permissionId === null) {
            return;
        }

        DB::table($tables['role_has_permissions'])
            ->where('permission_id', $permissionId)
            ->delete();

        DB::table($tables['permissions'])
            ->where('id', $permissionId)
            ->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
