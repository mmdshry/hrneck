<?php

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
    $this->tenant = Tenant::query()->findOrFail('itneck');
});

test('org can launch training campaign by group_ids', function () {
    Mail::fake();

    Tenancy::initialize($this->tenant);
    $courseId = Course::query()->value('id');
    $targets = Target::query()->limit(2)->get();
    $group = Group::query()->create(['name' => 'Security team', 'source' => 'manual']);
    $group->targets()->sync($targets->pluck('id')->all());
    $groupId = $group->id;
    Tenancy::end();

    expect($courseId)->not->toBeNull();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Group assign wave',
            'type' => 'training',
            'course_id' => $courseId,
            'group_ids' => [$groupId],
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'running');

    Tenancy::initialize($this->tenant);
    $campaign = Campaign::query()->where('name', 'Group assign wave')->with('recipients')->firstOrFail();
    expect($campaign->recipients)->toHaveCount($targets->count());
    expect(
        Enrollment::query()->where('course_id', $courseId)->whereIn('target_id', $targets->pluck('id'))->count()
    )->toBe($targets->count());
    Tenancy::end();
});

test('org can assign multiple courses via course_ids', function () {
    Mail::fake();

    Tenancy::initialize($this->tenant);
    $targetIds = Target::query()->limit(2)->pluck('id')->all();
    $courseA = Course::query()->create([
        'title' => 'Multi assign A',
        'description' => null,
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $courseB = Course::query()->create([
        'title' => 'Multi assign B',
        'description' => null,
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $courseIds = [$courseA->id, $courseB->id];
    Tenancy::end();

    $response = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Multi course wave',
            'course_ids' => $courseIds,
            'target_ids' => $targetIds,
            'launch' => true,
        ])
        ->assertCreated()
        ->json('data');

    expect($response['assigned_target_ids'])->toHaveCount(count($targetIds));
    expect($response['campaigns'])->toHaveCount(2);
    expect($response['courses'])->toHaveCount(2);
    expect($response['campaign']['status'])->toBe('running');
    expect($response['course']['id'])->toBe($courseIds[0]);

    Tenancy::initialize($this->tenant);
    expect(
        Enrollment::query()
            ->whereIn('course_id', $courseIds)
            ->whereIn('target_id', $targetIds)
            ->count()
    )->toBe(count($courseIds) * count($targetIds));
    expect(
        Campaign::query()
            ->whereIn('course_id', $courseIds)
            ->where('status', 'running')
            ->count()
    )->toBe(2);
    Tenancy::end();
});

test('org can assign single article content to targets', function () {
    Mail::fake();

    Tenancy::initialize($this->tenant);
    $targetIds = Target::query()->limit(2)->pluck('id')->all();
    Tenancy::end();

    $response = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Article blast',
            'content' => [
                'title' => 'Security spotting tip',
                'content_type' => 'text',
                'body' => 'Look for odd sender domains.',
                'description' => 'One-lesson assignment',
            ],
            'target_ids' => $targetIds,
            'launch' => true,
        ])
        ->assertCreated()
        ->json('data');

    expect($response['assigned_target_ids'])->toHaveCount(count($targetIds));
    expect($response['course']['title'])->toBe('Security spotting tip');
    expect($response['course']['lessons'])->toHaveCount(1);
    expect($response['course']['lessons'][0]['content_type'])->toBe('text');
    expect($response['campaign']['status'])->toBe('running');
});

test('assign still succeeds when training reminder SMTP fails', function () {
    Mail::shouldReceive('raw')
        ->atLeast()
        ->once()
        ->andThrow(new RuntimeException('SMTP 550 Invalid recipient'));

    Tenancy::initialize($this->tenant);
    $targetIds = Target::query()->limit(1)->pluck('id')->all();
    Tenancy::end();

    $response = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'SMTP fail wave',
            'content' => [
                'title' => 'Reminder failure course',
                'content_type' => 'text',
                'body' => 'Body',
            ],
            'target_ids' => $targetIds,
            'launch' => true,
        ])
        ->assertCreated()
        ->json('data');

    expect($response['assigned_target_ids'])->toHaveCount(1);

    Tenancy::initialize($this->tenant);
    expect(
        Enrollment::query()
            ->where('course_id', $response['course']['id'])
            ->whereIn('target_id', $targetIds)
            ->count()
    )->toBe(1);
    expect(
        CampaignRecipient::query()
            ->where('status', 'failed')
            ->count()
    )->toBeGreaterThan(0);
    Tenancy::end();
});

test('org can filter enrollments by group and export viewing csv', function () {
    Tenancy::initialize($this->tenant);
    $course = Course::query()->create([
        'title' => 'Viewing report course',
        'description' => 'Isolated for report test',
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $lesson = Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Intro',
        'content_type' => 'text',
        'body' => 'Hello',
        'sort_order' => 1,
    ]);
    $targets = Target::query()->limit(2)->get();
    $group = Group::query()->create(['name' => 'Report group', 'source' => 'manual']);
    $group->targets()->sync([$targets[0]->id]);

    $enrollment = Enrollment::query()->create([
        'course_id' => $course->id,
        'target_id' => $targets[0]->id,
        'status' => 'in_progress',
        'progress' => 40,
        'opened_at' => now(),
        'source' => 'manual',
    ]);
    LessonProgress::query()->create([
        'enrollment_id' => $enrollment->id,
        'lesson_id' => $lesson->id,
        'status' => 'in_progress',
        'progress_pct' => 40,
        'watched_seconds' => 12,
        'opened_at' => now(),
    ]);
    Enrollment::query()->create([
        'course_id' => $course->id,
        'target_id' => $targets[1]->id,
        'status' => 'assigned',
        'progress' => 0,
        'source' => 'manual',
    ]);
    $groupId = $group->id;
    $courseId = $course->id;
    $targetEmail = $targets[0]->email;
    $targetId = $targets[0]->id;
    Tenancy::end();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->getJson("/api/v1/org/training/enrollments?group_id={$groupId}&course_id={$courseId}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.target_id', $targetId)
        ->assertJsonPath('data.0.lesson_progress.0.watched_seconds', 12);

    $csv = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->get("/api/v1/org/training/enrollments/export?group_id={$groupId}&course_id={$courseId}")
        ->assertOk()
        ->streamedContent();

    expect($csv)->toContain('learner_email');
    expect($csv)->toContain($targetEmail);
    expect($csv)->toContain('watched_seconds');

    $pdfResponse = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->get("/api/v1/org/training/enrollments/export/pdf?group_id={$groupId}&course_id={$courseId}")
        ->assertOk();

    expect($pdfResponse->headers->get('content-type'))->toContain('application/pdf');
    expect($pdfResponse->streamedContent())->toStartWith('%PDF');
});
