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
| Migrate + TestingTenancySeeder once per process. Central DB uses
| RefreshDatabase transactions. Tenant DBs reset with a light fixture for
| only the tenants touched by the previous test.
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

/**
 * Body of a password sign-in on an organization's own address. The web app sends the organization of the host as `tenant`.
 *
 * @return array{email: string, password: string, tenant: string, scope: string}
 */
function tenantLoginBody(string $tenant, string $email, string $password): array
{
    return ['email' => $email, 'password' => $password, 'tenant' => $tenant, 'scope' => 'tenant'];
}

/**
 * Body of a password sign-in on the platform staff host (app.{base}), for accounts that have no organization.
 *
 * @return array{email: string, password: string, scope: string}
 */
function staffLoginBody(string $email, string $password): array
{
    return ['email' => $email, 'password' => $password, 'scope' => 'platform'];
}
