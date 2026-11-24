<?php

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Models\Tenant;
use Illuminate\Support\Facades\Mail;
use Stancl\Tenancy\Facades\Tenancy;

test('org can launch training campaign and queue reminders', function () {
    Mail::fake();

    $user = orgAdmin();
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $courseId = Course::query()->value('id');
    $targetIds = Target::query()->limit(2)->pluck('id')->all();
    Tenancy::end();

    expect($courseId)->not->toBeNull()->and($targetIds)->not->toBeEmpty();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Training wave',
            'type' => 'training',
            'course_id' => $courseId,
            'target_ids' => $targetIds,
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'training')
        ->assertJsonPath('data.status', 'running');

    Tenancy::initialize($tenant);
    $campaign = Campaign::query()->where('type', 'training')->where('name', 'Training wave')->with('recipients')->firstOrFail();
    expect($campaign->recipients)->toHaveCount(count($targetIds));
    expect($campaign->recipients->every(fn ($r) => $r->status === 'sent'))->toBeTrue();
    Tenancy::end();
});

test('an empty training dashboard does not invent a no-action rate', function () {
    $user = orgAdmin();

    $dash = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/campaigns/dashboard?type=training')
        ->assertOk()
        ->json('data');

    expect($dash['campaigns_total'])->toBe(0)
        ->and($dash['enrollments_total'])->toBe(0)
        ->and($dash['no_action_pct'])->toBe(0)
        ->and($dash['opened_pct'])->toBe(0)
        ->and($dash['completed_pct'])->toBe(0);
});

test('a course used by a campaign cannot be deleted', function () {
    $user = orgAdmin();
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $course = Course::query()->create([
        'title' => 'Keep linked course',
        'duration_minutes' => 5,
    ]);
    $targetId = Target::query()->value('id');
    Tenancy::end();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Uses linked course',
            'course_id' => $course->id,
            'target_ids' => [$targetId],
            'launch' => false,
        ])
        ->assertCreated();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/training/courses/'.$course->id)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['course']);

    Tenancy::initialize($tenant);
    expect(Course::query()->whereKey($course->id)->exists())->toBeTrue();
    Campaign::query()->where('course_id', $course->id)->delete();
    Tenancy::end();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/training/courses/'.$course->id)
        ->assertOk();
});
