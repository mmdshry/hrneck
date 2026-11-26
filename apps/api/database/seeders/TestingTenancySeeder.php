<?php

namespace Database\Seeders;

use App\Models\Tenant;
use Database\Seeders\Concerns\SeedsStandardDemoTenants;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Lightweight tenancy fixture for Pest Feature tests.
 *
 * Seeds itneck/test/company + TenantSampleSeeder, and skips the local mmdshry org.
 */
class TestingTenancySeeder extends Seeder
{
    use SeedsStandardDemoTenants;

    /** Base table names shared by every tenant; cleared whenever tenant schemas are rebuilt. */
    private static ?array $tableNames = null;

    public function run(): void
    {
        self::$tableNames = null;
        $this->seedPlatformAdmin();
        $tenantIds = $this->seedStandardDemoTenants();
        $this->migrateAndSeedTenantSamples($tenantIds, fresh: true);
        $this->seedStandardDemoOrgAdmins();
    }

    /**
     * Wipe tenant data tables and re-apply a light fixture without audience provisioning.
     *
     * Callers that wrap tenancy in test transactions should disable that wrapping
     * around this method (truncate implies commit on MySQL).
     *
     * @param  list<string>|null  $tenantIds
     */
    public static function resetTenantSampleData(?array $tenantIds = null): void
    {
        $tenantIds ??= ['itneck', 'test', 'company'];

        foreach ($tenantIds as $tenantId) {
            $tenant = Tenant::query()->find($tenantId);
            if ($tenant === null) {
                continue;
            }

            tenancy()->initialize($tenant);

            $tables = self::$tableNames ??= self::baseTableNames();

            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            foreach ($tables as $table) {
                DB::table($table)->truncate();
            }
            DB::statement('SET FOREIGN_KEY_CHECKS=1');

            (new TestingTenantFixtureSeeder)->run();
            tenancy()->end();
        }
    }

    /** @return list<string> */
    private static function baseTableNames(): array
    {
        return collect(DB::select('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE']))
            ->map(static fn (object $row): string => (string) array_values((array) $row)[0])
            ->reject(static fn (string $table): bool => $table === 'migrations')
            ->values()
            ->all();
    }
}
