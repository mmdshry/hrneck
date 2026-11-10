<?php

use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

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
        ->assertOk();

    expect($response->headers->get('content-type'))->toContain('text/csv');

    $content = $response->streamedContent();
    expect($content)->toContain('email')
        ->and($content)->toContain('department');
});

test('unknown report section returns not found', function () {
    $user = orgAdmin();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/detailed/not-a-section')
        ->assertNotFound();
});
