<?php

use App\Domains\AnalyticsReporting\Actions\BuildExportCalendar;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Facades\Tenancy;

/**
 * @return list<string>
 */
function captureQueries(callable $callback): array
{
    $queries = [];
    DB::listen(function ($query) use (&$queries): void {
        $queries[] = $query->sql;
    });
    $callback();

    return $queries;
}

test('org users index stays within a bounded query budget', function () {
    $user = orgAdmin();

    $queries = captureQueries(function () use ($user): void {
        $this->actingAs($user)
            ->withHeader('X-Tenant', 'itneck')
            ->getJson('/api/v1/org/users?per_page=25')
            ->assertOk();
    });

    $userSelects = collect($queries)->filter(
        fn (string $sql): bool => str_contains(strtolower($sql), 'from `users`')
            || str_contains(strtolower($sql), 'from users'),
    )->count();

    // One page of users + roles/permissions lookups should not fan out per row.
    expect(count($queries))->toBeLessThan(40)
        ->and($userSelects)->toBeLessThan(8);
});

test('export calendar uses a constant query count', function () {
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);

    $queries = captureQueries(function (): void {
        app(BuildExportCalendar::class)->handle((int) now()->year);
    });

    Tenancy::end();

    expect(count($queries))->toBeLessThanOrEqual(3);
});

test('reports detailed overview avoids per-department recipient scans', function () {
    $user = orgAdmin();

    $queries = captureQueries(function () use ($user): void {
        $this->actingAs($user)
            ->withHeader('X-Tenant', 'itneck')
            ->getJson('/api/v1/org/reports/detailed')
            ->assertOk();
    });

    $recipientScans = collect($queries)->filter(
        fn (string $sql): bool => str_contains(strtolower($sql), 'campaign_recipients')
            && str_contains(strtolower($sql), 'exists'),
    )->count();

    expect($recipientScans)->toBe(0)
        ->and(count($queries))->toBeLessThan(120);
});

test('branding endpoint reuses cache on repeated reads', function () {
    $user = orgAdmin();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/branding')
        ->assertOk();

    $queries = captureQueries(function () use ($user): void {
        $this->actingAs($user)
            ->withHeader('X-Tenant', 'itneck')
            ->getJson('/api/v1/org/branding')
            ->assertOk();
    });

    $settingsReads = collect($queries)->filter(
        fn (string $sql): bool => str_contains(strtolower($sql), 'organization_settings'),
    )->count();

    expect($settingsReads)->toBe(0);
});
