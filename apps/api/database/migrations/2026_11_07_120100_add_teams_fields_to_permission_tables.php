<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * For databases that already ran permission tables before teams were enabled.
 * Fresh installs get team columns from create_permission_tables (teams=true).
 */
return new class extends Migration
{
    public function up(): void
    {
        $tableNames = config('permission.table_names');
        $teamKey = config('permission.column_names.team_foreign_key', 'tenant_id');

        if (! Schema::hasColumn($tableNames['roles'], $teamKey)) {
            Schema::table($tableNames['roles'], function (Blueprint $table) use ($teamKey): void {
                $table->string($teamKey)->nullable()->after('id');
                $table->index($teamKey, 'roles_team_foreign_key_index');
            });

            try {
                Schema::table($tableNames['roles'], function (Blueprint $blueprint): void {
                    $blueprint->dropUnique(['name', 'guard_name']);
                });
            } catch (\Throwable) {
                try {
                    Schema::table($tableNames['roles'], function (Blueprint $blueprint): void {
                        $blueprint->dropUnique('roles_name_guard_name_unique');
                    });
                } catch (\Throwable) {
                    // already team-scoped or absent
                }
            }

            Schema::table($tableNames['roles'], function (Blueprint $table) use ($teamKey): void {
                $table->unique([$teamKey, 'name', 'guard_name'], 'roles_team_name_guard_unique');
            });
        }

        if (! Schema::hasColumn($tableNames['model_has_roles'], $teamKey)) {
            Schema::table($tableNames['model_has_roles'], function (Blueprint $table) use ($teamKey): void {
                $table->string($teamKey)->nullable()->after('role_id');
                $table->index($teamKey, 'model_has_roles_team_foreign_key_index');
            });
        }

        if (! Schema::hasColumn($tableNames['model_has_permissions'], $teamKey)) {
            Schema::table($tableNames['model_has_permissions'], function (Blueprint $table) use ($teamKey): void {
                $table->string($teamKey)->nullable()->after('permission_id');
                $table->index($teamKey, 'model_has_permissions_team_foreign_key_index');
            });
        }
    }

    public function down(): void
    {
        // Irreversible safely on mixed fresh/upgraded installs.
    }
};
