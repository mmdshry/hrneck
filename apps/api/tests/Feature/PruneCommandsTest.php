<?php

use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\Models\Activity;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('hrneck prune-activity-logs deletes only rows older than retention', function () {
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $old = activity('targets')->log('old target event');
    $old->forceFill(['created_at' => now()->subDays(200)])->save();

    $fresh = activity('targets')->log('fresh target event');
    $fresh->forceFill(['created_at' => now()->subDays(10)])->save();

    $oldId = $old->id;
    $freshId = $fresh->id;
    Tenancy::end();

    Artisan::call('hrneck:prune-activity-logs', ['--days' => 180]);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Activity::query()->whereKey($oldId)->exists())->toBeFalse()
        ->and(Activity::query()->whereKey($freshId)->exists())->toBeTrue();
    Tenancy::end();
});

test('hrneck prune-report-archives deletes old archives and files', function () {
    Storage::fake('local');
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $path = 'reports/old-archive.pdf';
    Storage::disk('local')->put($path, 'pdf-bytes');

    $old = ReportArchive::query()->create([
        'name' => 'Old archive',
        'scope' => 'org',
        'period_type' => 'monthly',
        'period_key' => '2025-01',
        'format' => 'pdf',
        'disk_path' => $path,
        'timezone' => 'UTC',
        'options' => [],
        'status' => 'ready',
        'generated_at' => now()->subDays(200),
    ]);

    $keep = ReportArchive::query()->create([
        'name' => 'Recent archive',
        'scope' => 'org',
        'period_type' => 'monthly',
        'period_key' => '2026-10',
        'format' => 'pdf',
        'disk_path' => 'reports/recent-archive.pdf',
        'timezone' => 'UTC',
        'options' => [],
        'status' => 'ready',
        'generated_at' => now()->subDays(5),
    ]);
    Storage::disk('local')->put('reports/recent-archive.pdf', 'keep');

    $oldId = $old->id;
    $keepId = $keep->id;
    Tenancy::end();

    Artisan::call('hrneck:prune-report-archives', ['--days' => 180]);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(ReportArchive::query()->whereKey($oldId)->exists())->toBeFalse()
        ->and(ReportArchive::query()->whereKey($keepId)->exists())->toBeTrue();
    Storage::disk('local')->assertMissing($path);
    Storage::disk('local')->assertExists('reports/recent-archive.pdf');
    Tenancy::end();
});
