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
 * - tenant DB via light truncate+fixture for tenants written to in the previous test
 */
trait RefreshTestingTenancy
{
    use RefreshDatabase;

    protected function refreshTestDatabase(): void
    {
        TestingTenancyState::registerListeners();

        if (! RefreshDatabaseState::$migrated) {
            TestingTenancyState::$bootstrapping = true;
            try {
                $this->artisan('migrate:fresh', $this->migrateFreshUsing());

                $this->app[Kernel::class]->setArtisan(null);

                $this->seed(TestingTenancySeeder::class);
                TestingTenancyState::$seeded = true;
            } finally {
                TestingTenancyState::$bootstrapping = false;
            }

            RefreshDatabaseState::$migrated = true;
        } elseif (TestingTenancyState::$seeded && TestingTenancyState::$tenantsToReset !== []) {
            if (tenancy()->initialized) {
                Tenancy::end();
            }

            $tenantIds = array_values(array_unique(TestingTenancyState::$tenantsToReset));
            TestingTenancyState::$tenantsToReset = [];

            TestingTenancyState::$bootstrapping = true;
            try {
                TestingTenancySeeder::resetTenantSampleData($tenantIds);
            } finally {
                TestingTenancyState::$bootstrapping = false;
            }
        }

        $this->endTenancyBeforeCentralRollback();
        $this->beginDatabaseTransaction();
    }

    protected function tearDownRefreshTestingTenancy(): void
    {
        if (function_exists('tenancy') && tenancy()->initialized) {
            Tenancy::end();
        }
    }

    /**
     * Laravel's teardown rolls back the central transaction after checking the *default*
     * connection. A test that ends inside a tenant request (X-Tenant middleware never reverts)
     * still has tenancy initialized, so that check runs against the tenant connection, clears
     * RefreshDatabaseState::$migrated and forces a full bootstrap before the next test.
     * Callbacks run in registration order, so ending tenancy here keeps the check on central.
     */
    private function endTenancyBeforeCentralRollback(): void
    {
        $this->beforeApplicationDestroyed(static function (): void {
            if (tenancy()->initialized) {
                Tenancy::end();
            }
        });
    }
}
