<?php

namespace Tests\Support;

use Illuminate\Support\Facades\Event;
use Stancl\Tenancy\Events\TenancyBootstrapped;

/**
 * Process-wide state for {@see RefreshTestingTenancy}.
 *
 * Pest creates a distinct test class per file; keep shared flags here.
 *
 * Tenants bootstrapped during test N are reset at the start of test N+1
 * (listener writes to $tenantsToReset; no tearDown required).
 *
 * Laravel builds a fresh application per test, so listeners must be attached
 * to each new event dispatcher; only the state arrays are process-wide.
 */
final class TestingTenancyState
{
    public static bool $seeded = false;

    /** Skip tenancy side-effects while TestingTenancySeeder bootstraps. */
    public static bool $bootstrapping = false;

    /** @var list<string> */
    public static array $tenantsToReset = [];

    public static function registerListeners(): void
    {
        Event::listen(TenancyBootstrapped::class, static function (): void {
            if (self::$bootstrapping) {
                return;
            }

            $tenantId = tenant('id');
            if (is_string($tenantId) && in_array($tenantId, ['itneck', 'test', 'company'], true)) {
                self::$tenantsToReset[] = $tenantId;
            }
        });
    }

    public static function markDirty(): void
    {
        self::$tenantsToReset = ['itneck', 'test', 'company'];
    }
}
