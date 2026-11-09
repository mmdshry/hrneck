<?php

use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('org can generate and download quarterly pdf', function () {
    Storage::fake('local');

    $user = orgAdmin();

    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/export', [
            'scope' => 'business',
            'period_type' => 'quarterly',
            'period_key' => '2026-Q3',
            'timezone' => 'UTC',
            'include_training' => true,
        ])
        ->assertCreated();

    $id = $response->json('data.id');
    expect($id)->not->toBeNull();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $archive = ReportArchive::query()->findOrFail($id);
    expect($archive->disk_path)->not->toBeEmpty();
    expect(Storage::disk('local')->exists($archive->disk_path))->toBeTrue();
    expect(Storage::disk('local')->size($archive->disk_path))->toBeGreaterThan(100);
    Tenancy::end();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->get('/api/v1/org/reports/export/'.$id.'/download')
        ->assertOk();
});
