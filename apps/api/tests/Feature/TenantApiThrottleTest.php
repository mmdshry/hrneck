<?php

use Database\Seeders\DemoSeeder;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);

    RateLimiter::for('tenant-api', function () {
        return Limit::perMinute(1)->by('tenant-api-test');
    });
});

test('tenant api throttle returns 429 after the configured limit', function () {
    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets')
        ->assertOk();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets')
        ->assertStatus(429);
});
