<?php

use App\Models\User;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature');
pest()->extend(TestCase::class)->in('Unit');

/**
 * Demo organization admin for tenant "itneck" (seeded by DemoSeeder).
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
