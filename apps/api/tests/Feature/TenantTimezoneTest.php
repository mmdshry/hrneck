<?php

use App\Domains\AnalyticsReporting\Actions\BuildBusinessReportMetrics;
use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Models\Tenant;
use App\Support\OrgTimezone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

function setTenantTimezoneForTest(string $timezone): void
{
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    DB::table('organization_settings')->updateOrInsert(
        ['id' => 1],
        ['timezone' => $timezone, 'updated_at' => now(), 'created_at' => now()],
    );
    Tenancy::end();
}

test('org timezone keeps valid zones and falls back to UTC otherwise', function () {
    expect(OrgTimezone::resolve(' Asia/Tehran '))->toBe('Asia/Tehran')
        ->and(OrgTimezone::resolve('Not/AZone'))->toBe('UTC')
        ->and(OrgTimezone::resolve(''))->toBe('UTC')
        ->and(OrgTimezone::resolve(null))->toBe('UTC');
});

test('targets no longer store a per person timezone column', function () {
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Schema::hasColumn('targets', 'timezone'))->toBeFalse();
    Tenancy::end();
});

test('creating a target does not require or return a timezone', function () {
    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'no.timezone@example.test',
            'first_name' => 'No',
            'last_name' => 'Timezone',
        ])
        ->assertCreated()
        ->assertJsonMissingPath('data.timezone');
});

test('report exports default to the organization timezone', function () {
    Storage::fake('local');
    setTenantTimezoneForTest('Asia/Tehran');

    $response = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/export', [
            'scope' => 'business',
            'period_type' => 'quarterly',
            'period_key' => '2026-Q3',
            'include_training' => true,
        ])
        ->assertCreated();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $archive = ReportArchive::query()->findOrFail($response->json('data.id'));
    expect($archive->timezone)->toBe('Asia/Tehran');
    Tenancy::end();
});

test('branding exposes the organization timezone and updates when settings change', function () {
    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/settings', ['timezone' => 'Asia/Tehran'])
        ->assertOk();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/branding')
        ->assertOk()
        ->assertJsonPath('data.timezone', 'Asia/Tehran');
});

test('business report labels generated_at in the organization timezone', function () {
    setTenantTimezoneForTest('Asia/Tehran');

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $report = app(BuildBusinessReportMetrics::class)->handle('2026-Q3');
    Tenancy::end();

    expect($report['timezone'])->toBe('Asia/Tehran')
        ->and($report['generated_at'])->toEndWith(' Asia/Tehran');
});
