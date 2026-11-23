<?php

use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\AnalyticsReporting\Actions\BuildTargetReportMetrics;
use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\Campaigns\Models\TrainingAssignmentEvent;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

/**
 * @param  list<array{type: string, at: string}>  $events
 */
function seedAssignmentForExport(array $overrides, array $events): TrainingAssignment
{
    $assignment = TrainingAssignment::query()->create(array_merge([
        'campaign_name' => 'Campaign',
        'course_title' => 'Course',
        'target_name' => 'Learner',
        'target_email' => 'learner-'.uniqid('', true).'@example.test',
        'group_name' => 'Engineering',
        'is_remedial' => false,
        'status' => 'no_action',
    ], $overrides));

    foreach ($events as $event) {
        TrainingAssignmentEvent::query()->create([
            'training_assignment_id' => $assignment->id,
            'type' => $event['type'],
            'occurred_at' => $event['at'],
        ]);
    }

    return $assignment;
}

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
        ->assertCreated()
        ->assertJsonMissingPath('data.disk_path');

    $id = $response->json('data.id');
    expect($id)->not->toBeNull();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/export', [
            'scope' => 'business',
            'period_type' => 'quarterly',
            'period_key' => '../evil',
            'timezone' => 'UTC',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['period_key']);

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

test('employee export supports single target list filter and validation', function () {
    Storage::fake('local');

    $user = orgAdmin();
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);

    $engineering = Group::query()->create(['name' => 'Engineering Export', 'source' => 'manual', 'status' => 'active']);
    $sales = Group::query()->create(['name' => 'Sales Export', 'source' => 'manual', 'status' => 'active']);
    $alice = Target::query()->create([
        'email' => 'alice.export@example.test',
        'first_name' => 'Alice',
        'last_name' => 'Export',
        'status' => 'active',
        'department' => 'Engineering',
        'job_title' => 'Analyst',
    ]);
    $bob = Target::query()->create([
        'email' => 'bob.export@example.test',
        'first_name' => 'Bob',
        'last_name' => 'Export',
        'status' => 'active',
    ]);

    seedAssignmentForExport([
        'target_id' => $alice->id,
        'target_name' => 'Alice Export',
        'target_email' => $alice->email,
        'group_id' => $engineering->id,
        'group_name' => $engineering->name,
        'course_title' => 'Phishing Basics',
    ], [
        ['type' => 'sent', 'at' => '2026-10-05 12:00:00'],
        ['type' => 'passed', 'at' => '2026-10-07 12:00:00'],
    ]);
    seedAssignmentForExport([
        'target_id' => $bob->id,
        'target_name' => 'Bob Export',
        'target_email' => $bob->email,
        'group_id' => $sales->id,
        'group_name' => $sales->name,
        'course_title' => 'Password Hygiene',
    ], [
        ['type' => 'sent', 'at' => '2026-10-05 12:00:00'],
        ['type' => 'failed', 'at' => '2026-10-08 12:00:00'],
    ]);
    seedAssignmentForExport([
        'target_id' => $alice->id,
        'target_name' => 'Alice Export',
        'target_email' => $alice->email,
        'group_id' => $engineering->id,
        'group_name' => $engineering->name,
        'course_title' => 'Q3 Course',
    ], [
        ['type' => 'sent', 'at' => '2026-07-10 12:00:00'],
        ['type' => 'passed', 'at' => '2026-07-12 12:00:00'],
    ]);
    seedAssignmentForExport([
        'target_id' => $bob->id,
        'target_name' => 'Bob Export',
        'target_email' => $bob->email,
        'group_id' => $sales->id,
        'group_name' => $sales->name,
        'course_title' => 'Q3 Sales Course',
    ], [
        ['type' => 'sent', 'at' => '2026-07-10 12:00:00'],
        ['type' => 'failed', 'at' => '2026-07-11 12:00:00'],
    ]);

    $singleMetrics = app(BuildTargetReportMetrics::class)->handle('2026-10', 'UTC', [
        'mode' => 'single',
        'target_id' => $alice->id,
    ]);
    expect($singleMetrics['mode'])->toBe('single')
        ->and($singleMetrics['employee']['email'])->toBe($alice->email)
        ->and($singleMetrics['summary']['assigned'])->toBe(1)
        ->and($singleMetrics['summary']['counts']['passed'])->toBe(1)
        ->and(collect($singleMetrics['assignments'])->pluck('course')->all())->toBe(['Phishing Basics']);

    $listMetrics = app(BuildTargetReportMetrics::class)->handle('2026-Q3', 'UTC', [
        'mode' => 'list',
        'group_id' => $engineering->id,
    ]);
    expect($listMetrics['mode'])->toBe('list')
        ->and($listMetrics['summary']['assigned'])->toBeGreaterThan(0)
        ->and(collect($listMetrics['employees'])->pluck('email')->all())->toBe([$alice->email]);

    $singlePdf = app(BuildQuarterlyPdfReport::class)->handle('2026-10', 'user', [
        'timezone' => 'UTC',
        'mode' => 'single',
        'target_id' => $alice->id,
    ]);
    expect(Storage::disk('local')->exists($singlePdf['path']))->toBeTrue()
        ->and(Storage::disk('local')->size($singlePdf['path']))->toBeGreaterThan(100);

    Tenancy::end();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/export', [
            'scope' => 'user',
            'mode' => 'single',
            'period_type' => 'monthly',
            'period_key' => '2026-10',
        ])
        ->assertStatus(422);

    $created = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/export', [
            'scope' => 'user',
            'mode' => 'single',
            'target_id' => $alice->id,
            'period_type' => 'monthly',
            'period_key' => '2026-10',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    expect($created->json('data.name'))->toContain('Alice');

    $listCreated = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/export', [
            'scope' => 'user',
            'mode' => 'list',
            'group_id' => $engineering->id,
            'period_type' => 'quarterly',
            'period_key' => '2026-Q3',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    expect($listCreated->json('data.name'))->toBe('EMPLOYEE LIST 2026-Q3');

    Tenancy::initialize($tenant);
    $archive = ReportArchive::query()->findOrFail($created->json('data.id'));
    expect($archive->scope)->toBe('user')
        ->and($archive->options['mode'] ?? null)->toBe('single')
        ->and((int) ($archive->options['target_id'] ?? 0))->toBe($alice->id);
    Tenancy::end();
});
