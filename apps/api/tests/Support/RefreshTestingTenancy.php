<?php

namespace Tests\Support;

use Database\Seeders\TestingTenancySeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Stancl\Tenancy\Facades\Tenancy;

/**
 * Migrate + seed standard demo tenancy once per process, then isolate:
 * - central DB via RefreshDatabase transactions
 * - tenant DB via truncate + TenantSampleSeeder before each test
 */
trait RefreshTestingTenancy
{
    use RefreshDatabase;

    protected function refreshTestDatabase(): void
    {
        if (! RefreshDatabaseState::$migrated) {
            $this->artisan('migrate:fresh', $this->migrateFreshUsing());

            $this->app[Kernel::class]->setArtisan(null);

            $this->seed(TestingTenancySeeder::class);
            TestingTenancyState::$seeded = true;

            RefreshDatabaseState::$migrated = true;
        } elseif (TestingTenancyState::$seeded) {
            // Tenant schemas are outside the central transaction; reset before each test.
            if (tenancy()->initialized) {
                Tenancy::end();
            }
            TestingTenancySeeder::resetTenantSampleData();
        }

        $this->beginDatabaseTransaction();
    }

    protected function tearDownRefreshTestingTenancy(): void
    {
        if (function_exists('tenancy') && tenancy()->initialized) {
            Tenancy::end();
        }
    }
}
