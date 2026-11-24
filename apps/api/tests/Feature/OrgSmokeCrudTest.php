<?php

use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Ticketing\Models\SdDesk;
use Illuminate\Support\Str;

test('org admin can perform core CRUD across modules', function () {
    $admin = orgAdmin();
    $tenant = 'itneck';
    $headers = ['X-Tenant' => $tenant];

    // Users
    $email = 'qa.user.'.Str::lower(Str::random(6)).'@itneck.test';
    $createUser = $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/users', [
        'name' => 'QA User',
        'email' => $email,
        'password' => 'DemoPass!234',
        'roles' => ['learner'],
    ])->assertCreated()->json('data');

    $this->actingAs($admin)->withHeaders($headers)
        ->patchJson('/api/v1/org/users/'.$createUser['id'], ['name' => 'QA User Updated'])
        ->assertOk();

    // Roles / settings (org_admin only)
    $role = $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/roles', [
        'name' => 'qa_role_'.Str::lower(Str::random(4)),
        'permissions' => ['org.reports.view'],
    ])->assertCreated()->json('data');

    $this->actingAs($admin)->withHeaders($headers)
        ->putJson('/api/v1/org/roles/'.$role['id'], [
            'name' => $role['name'],
            'permissions' => ['org.reports.view', 'org.announcements.manage'],
        ])->assertOk();

    $this->actingAs($admin)->withHeaders($headers)
        ->putJson('/api/v1/org/settings', [
            'display_name' => 'ITneck QA',
            'timezone' => 'UTC',
        ])->assertOk();

    // Department / group / target
    $dept = $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/departments', [
        'name' => 'QA Dept '.Str::random(4),
    ])->assertCreated()->json('data');

    $targetEmail = 'qa.target.'.Str::lower(Str::random(6)).'@example.test';
    $target = $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/targets', [
        'email' => $targetEmail,
        'first_name' => 'QA',
        'last_name' => 'Target',
        'department_id' => $dept['id'],
        'timezone' => 'UTC',
    ])->assertCreated()->json('data');

    $group = $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/groups', [
        'name' => 'QA Group '.Str::random(4),
        'target_ids' => [$target['id']],
    ])->assertCreated()->json('data');

    $this->actingAs($admin)->withHeaders($headers)
        ->patchJson('/api/v1/org/targets/'.$target['id'], ['first_name' => 'QA2'])
        ->assertOk();

    // Announcement
    $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/announcements', [
        'title' => 'QA notice',
        'body' => 'Smoke CRUD announcement',
    ])->assertCreated();

    // Checklist instance assign (non-system template)
    $template = ChecklistTemplate::query()->where('is_system', false)->first();
    if ($template) {
        $assign = $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/checklists/instances', [
            'template_id' => $template->id,
            'target_ids' => [$target['id']],
        ]);
        expect(in_array($assign->status(), [200, 201, 422], true))->toBeTrue();
    }

    // Ticketing create when desk exists
    $desk = SdDesk::query()->first();
    if ($desk) {
        $this->actingAs($admin)->withHeaders($headers)->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $desk->id,
            'summary' => 'QA ticket '.Str::random(4),
            'description' => 'Smoke CRUD ticket',
        ])->assertSuccessful();
    }

    // Cleanup deletes
    $this->actingAs($admin)->withHeaders($headers)
        ->deleteJson('/api/v1/org/groups/'.$group['id'])
        ->assertSuccessful();
    $this->actingAs($admin)->withHeaders($headers)
        ->deleteJson('/api/v1/org/targets/'.$target['id'])
        ->assertSuccessful();
    $this->actingAs($admin)->withHeaders($headers)
        ->deleteJson('/api/v1/org/departments/'.$dept['id'])
        ->assertSuccessful();
    $this->actingAs($admin)->withHeaders($headers)
        ->deleteJson('/api/v1/org/roles/'.$role['id'])
        ->assertSuccessful();
    $this->actingAs($admin)->withHeaders($headers)
        ->deleteJson('/api/v1/org/users/'.$createUser['id'])
        ->assertSuccessful();
});

test('staff enter cannot manage roles or settings', function () {
    $platform = platformAdmin();
    $origin = ['Origin' => 'http://hrneck.test'];

    $this->actingAs($platform)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    $this->actingAs($platform)->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/roles')
        ->assertForbidden();

    $this->actingAs($platform)->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->putJson('/api/v1/org/settings', ['display_name' => 'Nope'])
        ->assertForbidden();
});
