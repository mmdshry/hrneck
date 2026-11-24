<?php

use App\Models\User;
use Tests\Support\RefreshTestingTenancy;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature');
pest()->extend(TestCase::class)->in('Unit');

/*
|--------------------------------------------------------------------------
| Feature tenancy bootstrap
|--------------------------------------------------------------------------
|
| Migrate + TestingTenancySeeder once per process, then isolate with
| central DB transactions and a tenant sample reset before each test.
|
*/
uses(RefreshTestingTenancy::class)->in('Feature');

/**
 * Demo organization admin for tenant "itneck" (seeded by TestingTenancySeeder).
 */
function orgAdmin(string $tenantId = 'itneck'): User
{
    return User::query()->where('email', 'admin@'.$tenantId.'.test')->firstOrFail();
}

/**
 * Platform super admin (Filament / MSP).
 */
function platformAdmin(): User
{
    return User::query()->where('email', config('brand.demo_admin_email'))->firstOrFail();
}
