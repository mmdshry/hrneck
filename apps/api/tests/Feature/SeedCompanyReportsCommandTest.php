<?php

use App\Console\Commands\SeedCompanyReportsCommand;
use App\Domains\AnalyticsReporting\Actions\BuildBusinessReportMetrics;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('company report seed creates employees quizzes and dated outcomes', function () {
    expect(Tenant::query()->whereKey('company')->exists())->toBeTrue();

    Artisan::call('hrneck:seed-company-reports', [
        '--fresh' => true,
        '--targets' => 40,
        '--chunk' => 20,
    ]);

    Tenancy::initialize(Tenant::query()->findOrFail('company'));

    expect(DB::table('targets')->where('email', 'like', '%@'.SeedCompanyReportsCommand::EMAIL_DOMAIN)->count())->toBe(40)
        ->and(DB::table('quizzes')->where('title', 'like', SeedCompanyReportsCommand::TITLE_PREFIX.'%')->count())->toBeGreaterThanOrEqual(100)
        ->and(DB::table('training_assignments')->where('campaign_name', 'like', SeedCompanyReportsCommand::TITLE_PREFIX.'%')->count())->toBeGreaterThan(0)
        ->and(DB::table('training_assignment_events')->count())->toBeGreaterThan(0);

    $october = app(BuildBusinessReportMetrics::class)->handle('2026-10', 'UTC');
    $quarter = app(BuildBusinessReportMetrics::class)->handle('2026-Q3', 'UTC');

    expect($october['training']['assigned'])->toBeGreaterThan(0)
        ->and($october['training']['details']['counts']['passed'])->toBeGreaterThan(0)
        ->and($october['training']['details']['rows'])->not->toBe([])
        ->and($quarter['training']['assigned'])->toBeGreaterThan(0)
        ->and($quarter['training']['details']['counts']['passed'])->toBeGreaterThan(0)
        ->and($quarter['training']['details']['rows'])->not->toBe([]);

    Tenancy::end();
});
