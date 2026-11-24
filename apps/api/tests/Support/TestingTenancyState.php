<?php

namespace Tests\Support;

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\Event;

/**
 * Process-wide state for {@see RefreshTestingTenancy}.
 *
 * Pest creates a distinct test class per file; keep shared flags here.
 *
 * A standard tenant is reset at the start of the next test only after a test wrote to its
 * database (QueryExecuted on the `tenant` connection). Read-only requests leave data untouched.
 *
 * Laravel builds a fresh application per test, so listeners must be attached
 * to each new event dispatcher; only the state arrays are process-wide.
 */
final class TestingTenancyState
{
    /** @var list<string> */
    private const TENANT_IDS = ['itneck', 'test', 'company'];

    /** Statements that cannot modify tenant data. Any other statement marks the tenant dirty. */
    private const READ_ONLY_STATEMENT = '/^\s*(select|show|describe|desc|explain|set|start|begin|commit|rollback|savepoint|release)\b/i';

    public static bool $seeded = false;

    /** Skip tenancy side-effects while TestingTenancySeeder bootstraps. */
    public static bool $bootstrapping = false;

    /** @var list<string> */
    public static array $tenantsToReset = [];

    public static function registerListeners(): void
    {
        Event::listen(QueryExecuted::class, static function (QueryExecuted $query): void {
            if (self::$bootstrapping || $query->connectionName !== 'tenant') {
                return;
            }

            if (preg_match(self::READ_ONLY_STATEMENT, $query->sql) === 1) {
                return;
            }

            $tenantId = tenancy()->initialized ? tenant('id') : null;
            if (! is_string($tenantId)) {
                // The owner of this write is unknown, so reset every standard tenant.
                self::markDirty();

                return;
            }

            if (in_array($tenantId, self::TENANT_IDS, true)) {
                self::$tenantsToReset[] = $tenantId;
            }
        });
    }

    public static function markDirty(): void
    {
        self::$tenantsToReset = self::TENANT_IDS;
    }
}
