<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Adds the *.view / fill / audit permissions to every existing organization:
 * - org_admin roles receive all new permissions (they already hold everything else);
 * - starter template roles are created where missing. Existing roles are never overwritten.
 *
 * Literal names are used on purpose so later catalog changes cannot alter this migration.
 * Grants are data changes and are intentionally not reversed in down().
 */
return new class extends Migration
{
    /** @var list<string> */
    private const NEW_PERMISSIONS = [
        'org.users.view',
        'org.targets.view',
        'org.departments.view',
        'org.groups.view',
        'org.campaigns.view',
        'org.training.view',
        'org.checklists.view',
        'org.checklists.fill',
        'org.settings.view',
        'org.audit.view',
    ];

    /** @var array<string, list<string>> */
    private const TEMPLATES = [
        'hr_manager' => [
            'org.users.manage',
            'org.users.view',
            'org.targets.manage',
            'org.targets.view',
            'org.departments.manage',
            'org.departments.view',
            'org.groups.view',
            'org.reports.view',
        ],
        'helpdesk_agent' => [
            'org.ticketing.tickets',
            'org.ticketing.kb',
            'org.ticketing.view_all',
        ],
        'auditor' => [
            'org.audit.view',
            'org.reports.view',
            'org.users.view',
            'org.targets.view',
            'org.departments.view',
            'org.groups.view',
            'org.campaigns.view',
            'org.training.view',
            'org.checklists.view',
            'org.settings.view',
        ],
        'campaign_manager' => [
            'org.campaigns.manage',
            'org.campaigns.view',
            'org.training.view',
            'org.groups.view',
            'org.targets.view',
            'org.reports.view',
        ],
        'it_viewer' => [
            'org.ticketing.tickets',
            'org.ticketing.kb',
            'org.ticketing.reports',
            'org.checklists.view',
        ],
    ];

    public function up(): void
    {
        $tables = config('permission.table_names');
        $teamKey = config('permission.column_names.team_foreign_key', 'tenant_id');
        $guard = 'web';
        $now = now();

        $names = array_values(array_unique([
            ...self::NEW_PERMISSIONS,
            ...array_merge(...array_values(self::TEMPLATES)),
        ]));

        DB::table($tables['permissions'])->insertOrIgnore(array_map(
            fn (string $name): array => [
                'name' => $name,
                'guard_name' => $guard,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            $names,
        ));

        /** @var array<string, int> $permissionIds */
        $permissionIds = DB::table($tables['permissions'])
            ->where('guard_name', $guard)
            ->whereIn('name', $names)
            ->pluck('id', 'name')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        $orgAdminRoleIds = DB::table($tables['roles'])
            ->where('name', 'org_admin')
            ->where('guard_name', $guard)
            ->whereNotNull($teamKey)
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all();

        $this->grant(
            $tables,
            $orgAdminRoleIds,
            array_values(array_intersect_key($permissionIds, array_flip(self::NEW_PERMISSIONS))),
        );

        $tenantIds = DB::table('tenants')->pluck('id')->all();
        foreach ($tenantIds as $tenantId) {
            foreach (self::TEMPLATES as $roleName => $permissionNames) {
                $exists = DB::table($tables['roles'])
                    ->where($teamKey, $tenantId)
                    ->where('name', $roleName)
                    ->where('guard_name', $guard)
                    ->exists();

                if ($exists) {
                    continue;
                }

                $roleId = (int) DB::table($tables['roles'])->insertGetId([
                    'name' => $roleName,
                    'guard_name' => $guard,
                    $teamKey => $tenantId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $this->grant(
                    $tables,
                    [$roleId],
                    array_values(array_intersect_key($permissionIds, array_flip($permissionNames))),
                );
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Intentionally empty: grants and organization-owned template roles may have been edited since.
    }

    /**
     * @param  array<string, string>  $tables
     * @param  list<int>  $roleIds
     * @param  list<int>  $permissionIds
     */
    private function grant(array $tables, array $roleIds, array $permissionIds): void
    {
        $rows = [];
        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $rows[] = ['permission_id' => $permissionId, 'role_id' => $roleId];
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($tables['role_has_permissions'])->insertOrIgnore($chunk);
        }
    }
};
