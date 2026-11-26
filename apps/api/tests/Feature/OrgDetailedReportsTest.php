<?php

use App\Domains\AnalyticsReporting\Actions\BuildOrgDetailedReport;
use App\Domains\TargetsGroups\Models\Department;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use Stancl\Tenancy\Facades\Tenancy;

test('org admin can load detailed reports overview', function () {
    $user = orgAdmin();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/detailed')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                'campaign' => [
                    'campaigns',
                    'campaigns_running',
                    'recipients',
                    'opened',
                    'completed',
                    'no_action',
                    'opened_pct',
                    'completed_pct',
                    'no_action_pct',
                    'enrollments',
                    'active_employees',
                ],
                'blocks' => [
                    'training' => [
                        'assigned',
                        'in_progress',
                        'completed',
                        'completion_rate',
                        'segments',
                    ],
                    'checklists' => [
                        'open',
                        'completed',
                        'cancelled',
                        'completion_rate',
                        'segments',
                    ],
                    'ticketing' => [
                        'open',
                        'resolved',
                        'sla_response_breached',
                        'sla_resolve_breached',
                    ],
                    'campaigns_people' => [
                        'campaigns_running',
                        'opened_pct',
                        'completed_pct',
                        'no_action_pct',
                        'active_employees',
                    ],
                ],
                'counts' => [
                    'users',
                    'targets',
                    'groups',
                    'campaigns',
                    'enrollments',
                    'checklist_templates',
                    'checklist_instances',
                    'tickets_open',
                    'tickets_resolved',
                ],
                'company' => [
                    'profile',
                    'by_department',
                    'by_group',
                    'by_role',
                ],
                'ticketing',
            ],
        ]);
});

test('org admin can load campaign summary funnel', function () {
    $user = orgAdmin();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/summary')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                'campaigns',
                'campaigns_running',
                'opened_pct',
                'completed_pct',
                'no_action_pct',
                'active_employees',
            ],
        ])
        ->assertJsonMissingPath('data.click_rate')
        ->assertJsonMissingPath('data.clicked');
});

test('org admin can paginate targets report section', function () {
    $user = orgAdmin();

    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/detailed/targets?per_page=10&page=1')
        ->assertOk()
        ->assertJsonPath('data.section', 'targets')
        ->assertJsonStructure([
            'data' => [
                'section',
                'data',
                'meta' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total',
                ],
            ],
        ]);

    expect($response->json('data.meta.per_page'))->toBe(10)
        ->and($response->json('data.meta.total'))->toBeGreaterThan(0)
        ->and($response->json('data.data'))->toBeArray();
});

test('org admin can download targets report csv', function () {
    $user = orgAdmin();

    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->get('/api/v1/org/reports/detailed/targets/csv')
        ->assertOk()
        ->assertHeader('X-Report-Truncated', '0');

    expect($response->headers->get('content-type'))->toContain('text/csv');

    $content = $response->streamedContent();
    expect($content)->toContain('email')
        ->and($content)->toContain('department');
});

test('users count follows the department on each membership', function () {
    $user = orgAdmin();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $sales = Department::query()->create(['name' => 'Sales Count QA', 'is_active' => true]);
    $support = Department::query()->create(['name' => 'Support Count QA', 'is_active' => true]);
    Tenancy::end();

    foreach ([$sales, $sales, $support] as $department) {
        $member = User::factory()->create();
        TenantMembership::query()->updateOrCreate(
            ['user_id' => $member->id, 'tenant_id' => 'itneck'],
            ['department_id' => $department->id, 'disabled_at' => null],
        );
    }

    $salesUsers = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/detailed?department_id='.$sales->id)
        ->assertOk()
        ->json('data.counts.users');

    $supportUsers = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/detailed?department_id='.$support->id)
        ->assertOk()
        ->json('data.counts.users');

    expect($salesUsers)->toBe(2)
        ->and($supportUsers)->toBe(1);
});

test('detailed csv sections include the date and name columns shown on screen', function () {
    $user = orgAdmin();

    $expectedColumns = [
        'campaigns' => ['course', 'no_action'],
        'training' => ['course', 'opened_at', 'completed_at'],
        'checklists' => ['name', 'started_at', 'completed_at'],
        'ticketing' => ['created_at', 'resolved_at'],
    ];

    foreach ($expectedColumns as $section => $columns) {
        $content = $this->actingAs($user)
            ->withHeader('X-Tenant', 'itneck')
            ->get("/api/v1/org/reports/detailed/{$section}/csv")
            ->assertOk()
            ->streamedContent();

        $header = str_getcsv((string) strtok($content, "\n"));

        expect($header, $section)->toContain(...$columns);
    }
});

test('targets csv flags truncation once it exceeds the row cap', function () {
    $rows = [];
    $now = now()->toDateTimeString();
    for ($i = 1; $i <= BuildOrgDetailedReport::CSV_ROW_CAP + 1; $i++) {
        $rows[] = [
            'email' => "cap.{$i}@example.test",
            'first_name' => 'Cap',
            'last_name' => (string) $i,
            'status' => 'active',
            'risk_score' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    foreach (array_chunk($rows, 500) as $chunk) {
        Target::query()->insert($chunk);
    }
    Tenancy::end();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->get('/api/v1/org/reports/detailed/targets/csv')
        ->assertOk()
        ->assertHeader('X-Report-Truncated', '1');
});

test('unknown report section returns not found', function () {
    $user = orgAdmin();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/detailed/not-a-section')
        ->assertNotFound();
});

test('campaign summary reports zero no-action when nobody is assigned', function () {
    $user = orgAdmin();

    $summary = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/summary')
        ->assertOk()
        ->json('data');

    expect($summary['enrollments'])->toBe(0)
        ->and($summary['recipients'])->toBe(0)
        ->and($summary['no_action'])->toBe(0)
        ->and($summary['no_action_pct'])->toBe(0)
        ->and($summary['opened_pct'])->toBe(0)
        ->and($summary['completed_pct'])->toBe(0);
});
