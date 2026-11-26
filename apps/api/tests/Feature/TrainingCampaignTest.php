<?php

use App\Domains\Campaigns\Actions\LaunchDueScheduledCampaigns;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Stancl\Tenancy\Facades\Tenancy;

function asCampaignWindowLearner($test, string $email, string $name): mixed
{
    $user = User::query()->where('email', $email)->first();
    if (! $user) {
        $user = app(CreateOrgUser::class)->handle(
            'itneck',
            $name,
            $email,
            'DemoPass!234',
            ['org_admin'],
        );
    }

    return $test->actingAs($user)->withHeader('X-Tenant', 'itneck');
}

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
    Campaign::query()
        ->whereHas('courses', fn ($query) => $query->where('courses.id', $course->id))
        ->delete();
    Tenancy::end();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/training/courses/'.$course->id)
        ->assertOk();
});

test('a campaign with a future start is held as scheduled until it starts', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $courseId = Course::query()->value('id');
    $targetIds = Target::query()->limit(2)->pluck('id')->all();
    Tenancy::end();

    $name = 'Held window '.Str::lower(Str::random(8));

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => $name,
            'type' => 'training',
            'course_id' => $courseId,
            'target_ids' => $targetIds,
            'starts_at' => now()->addDays(2)->toIso8601String(),
            'expires_at' => now()->addDays(9)->toIso8601String(),
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonCount(0, 'data.recipients');

    Tenancy::initialize($tenant);
    $campaign = Campaign::query()->where('name', $name)->firstOrFail();
    expect($campaign->recipients()->count())->toBe(0)
        ->and($campaign->expires_at)->not->toBeNull()
        ->and($campaign->launchAudience()['target_ids'] ?? [])->toHaveCount(count($targetIds))
        ->and(TrainingAssignment::query()->where('campaign_id', $campaign->id)->whereNull('recipient_id')->count())
        ->toBe(count($targetIds));
    Tenancy::end();
});

test('an expiration that is not after the start is rejected', function () {
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $courseId = Course::query()->value('id');
    $targetIds = Target::query()->limit(1)->pluck('id')->all();
    Tenancy::end();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Inverted window '.Str::lower(Str::random(6)),
            'type' => 'training',
            'course_id' => $courseId,
            'target_ids' => $targetIds,
            'starts_at' => now()->addDays(3)->toIso8601String(),
            'expires_at' => now()->addDays(2)->toIso8601String(),
            'launch' => true,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['expires_at']);
});

test('the scheduler launches a held campaign once its start time arrives', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $courseId = Course::query()->value('id');
    $targetIds = Target::query()->limit(2)->pluck('id')->all();
    Tenancy::end();

    $name = 'Scheduler wave '.Str::lower(Str::random(8));

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => $name,
            'type' => 'training',
            'course_id' => $courseId,
            'target_ids' => $targetIds,
            'starts_at' => now()->addDay()->toIso8601String(),
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'scheduled');

    Tenancy::initialize($tenant);
    $campaign = Campaign::query()->where('name', $name)->firstOrFail();

    app(LaunchDueScheduledCampaigns::class)->handle();
    expect($campaign->refresh()->status)->toBe('scheduled');

    $campaign->forceFill(['starts_at' => now()->subMinute()])->save();
    app(LaunchDueScheduledCampaigns::class)->handle();

    $campaign->refresh()->load('recipients');
    expect($campaign->status)->toBe('running')
        ->and($campaign->recipients)->toHaveCount(count($targetIds));
    Tenancy::end();
});

test('an assignment with a future start is held as scheduled', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $courseId = Course::query()->value('id');
    $targetIds = Target::query()->limit(2)->pluck('id')->all();
    Tenancy::end();

    $response = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Held assign '.Str::lower(Str::random(6)),
            'course_ids' => [$courseId],
            'target_ids' => $targetIds,
            'starts_at' => now()->addDays(2)->toIso8601String(),
            'launch' => true,
        ])
        ->assertCreated()
        ->json('data');

    expect($response['campaign']['status'])->toBe('scheduled')
        ->and($response['campaign']['recipients'])->toHaveCount(0);
});

test('learners lose access to a campaign after its expiration', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $course = Course::query()->create([
        'title' => 'Window course '.Str::lower(Str::random(6)),
        'description' => null,
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
    $target = Target::query()->firstOrFail();
    $email = $target->email;
    $targetId = $target->id;
    $courseId = $course->id;
    $lessonId = $lesson->id;
    Tenancy::end();

    $campaignId = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Window wave',
            'course_ids' => [$courseId],
            'target_ids' => [$targetId],
            'starts_at' => now()->subHour()->toIso8601String(),
            'expires_at' => now()->addDay()->toIso8601String(),
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.campaign.status', 'running')
        ->json('data.campaign.id');

    Tenancy::initialize($tenant);
    $enrollmentId = Enrollment::query()
        ->where('course_id', $courseId)
        ->where('target_id', $targetId)
        ->value('id');
    Tenancy::end();

    $progress = [
        'enrollment_id' => $enrollmentId,
        'lesson_id' => $lessonId,
        'progress_pct' => 50,
    ];

    asCampaignWindowLearner($this, $email, 'Window Learner')
        ->postJson('/api/v1/org/training/progress/lesson', $progress)
        ->assertOk();

    Tenancy::initialize($tenant);
    Campaign::query()->whereKey($campaignId)->update(['expires_at' => now()->subMinute()]);
    Tenancy::end();

    asCampaignWindowLearner($this, $email, 'Window Learner')
        ->postJson('/api/v1/org/training/progress/lesson', $progress)
        ->assertForbidden()
        ->assertJsonPath('message', 'This training has expired.');

    asCampaignWindowLearner($this, $email, 'Window Learner')
        ->getJson('/api/v1/org/training/assignments?course_id='.$courseId)
        ->assertOk()
        ->assertJsonPath('data.0.availability', 'expired')
        ->assertJsonMissingPath('data.0.assignments');
});

test('learners are held before the start and locked out of quizzes and media after expiry', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $course = Course::query()->create([
        'title' => 'Held course '.Str::lower(Str::random(6)),
        'description' => null,
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
    $quiz = Quiz::query()->create([
        'course_id' => $course->id,
        'title' => 'Check',
        'pass_score' => 70,
    ]);
    QuizQuestion::query()->create([
        'quiz_id' => $quiz->id,
        'prompt' => 'Ok?',
        'options' => ['Yes', 'No'],
        'correct_index' => 0,
    ]);
    $target = Target::query()->firstOrFail();
    $email = $target->email;
    $targetId = $target->id;
    $courseId = $course->id;
    $lessonId = $lesson->id;
    $quizId = $quiz->id;
    Tenancy::end();

    $campaignId = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Held wave',
            'course_ids' => [$courseId],
            'target_ids' => [$targetId],
            'starts_at' => now()->subHour()->toIso8601String(),
            'expires_at' => now()->addDay()->toIso8601String(),
            'launch' => true,
        ])
        ->assertCreated()
        ->json('data.campaign.id');

    Tenancy::initialize($tenant);
    $enrollmentId = Enrollment::query()
        ->where('course_id', $courseId)
        ->where('target_id', $targetId)
        ->value('id');
    Campaign::query()->whereKey($campaignId)->update([
        'starts_at' => now()->addDay(),
        'expires_at' => null,
    ]);
    Tenancy::end();

    asCampaignWindowLearner($this, $email, 'Held Learner')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollmentId,
            'lesson_id' => $lessonId,
            'progress_pct' => 50,
        ])
        ->assertForbidden()
        ->assertJsonPath('message', 'This training is not available yet.');

    asCampaignWindowLearner($this, $email, 'Held Learner')
        ->postJson('/api/v1/org/training/quiz', [
            'quiz_id' => $quizId,
            'enrollment_id' => $enrollmentId,
            'answers' => [0],
        ])
        ->assertForbidden()
        ->assertJsonPath('message', 'This training is not available yet.');

    asCampaignWindowLearner($this, $email, 'Held Learner')
        ->getJson('/api/v1/org/training/media/'.$lessonId)
        ->assertForbidden()
        ->assertJsonPath('message', 'This training is not available yet.');

    Tenancy::initialize($tenant);
    Campaign::query()->whereKey($campaignId)->update([
        'starts_at' => now()->subDay(),
        'expires_at' => now()->subMinute(),
    ]);
    Tenancy::end();

    asCampaignWindowLearner($this, $email, 'Held Learner')
        ->postJson('/api/v1/org/training/quiz', [
            'quiz_id' => $quizId,
            'enrollment_id' => $enrollmentId,
            'answers' => [0],
        ])
        ->assertForbidden()
        ->assertJsonPath('message', 'This training has expired.');

    asCampaignWindowLearner($this, $email, 'Held Learner')
        ->getJson('/api/v1/org/training/media/'.$lessonId)
        ->assertForbidden()
        ->assertJsonPath('message', 'This training has expired.');
});

test('campaigns without dates never restrict learners', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $course = Course::query()->create([
        'title' => 'Undated course '.Str::lower(Str::random(6)),
        'description' => null,
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
    $target = Target::query()->firstOrFail();
    $email = $target->email;
    $targetId = $target->id;
    $courseId = $course->id;
    $lessonId = $lesson->id;
    Tenancy::end();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Undated wave',
            'course_ids' => [$courseId],
            'target_ids' => [$targetId],
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.campaign.status', 'running');

    Tenancy::initialize($tenant);
    $enrollmentId = Enrollment::query()
        ->where('course_id', $courseId)
        ->where('target_id', $targetId)
        ->value('id');
    Tenancy::end();

    asCampaignWindowLearner($this, $email, 'Undated Learner')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollmentId,
            'lesson_id' => $lessonId,
            'progress_pct' => 50,
        ])
        ->assertOk();

    asCampaignWindowLearner($this, $email, 'Undated Learner')
        ->getJson('/api/v1/org/training/assignments?course_id='.$courseId)
        ->assertOk()
        ->assertJsonPath('data.0.availability', 'available');
});

test('learners see a held campaign as upcoming until the scheduler launches it', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $course = Course::query()->create([
        'title' => 'Upcoming course '.Str::lower(Str::random(6)),
        'description' => null,
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
    $target = Target::query()->firstOrFail();
    $email = $target->email;
    $targetId = $target->id;
    $courseId = $course->id;
    $lessonId = $lesson->id;
    Tenancy::end();

    $campaignId = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Upcoming wave',
            'course_ids' => [$courseId],
            'target_ids' => [$targetId],
            'starts_at' => now()->addDay()->toIso8601String(),
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.campaign.status', 'scheduled')
        ->json('data.campaign.id');

    Tenancy::initialize($tenant);
    $enrollmentId = Enrollment::query()
        ->where('course_id', $courseId)
        ->where('target_id', $targetId)
        ->value('id');
    Tenancy::end();

    expect($enrollmentId)->not->toBeNull();

    asCampaignWindowLearner($this, $email, 'Upcoming Learner')
        ->getJson('/api/v1/org/training/assignments?course_id='.$courseId)
        ->assertOk()
        ->assertJsonPath('data.0.availability', 'upcoming');

    asCampaignWindowLearner($this, $email, 'Upcoming Learner')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollmentId,
            'lesson_id' => $lessonId,
            'progress_pct' => 50,
        ])
        ->assertForbidden()
        ->assertJsonPath('message', 'This training is not available yet.');

    Tenancy::initialize($tenant);
    Campaign::query()->whereKey($campaignId)->update(['starts_at' => now()->subMinute()]);
    app(LaunchDueScheduledCampaigns::class)->handle();
    $launched = Campaign::query()->whereKey($campaignId)->firstOrFail();
    $attachedRecipients = TrainingAssignment::query()
        ->where('campaign_id', $campaignId)
        ->whereNotNull('recipient_id')
        ->count();
    Tenancy::end();

    expect($launched->status)->toBe('running')
        ->and($attachedRecipients)->toBe(1);

    asCampaignWindowLearner($this, $email, 'Upcoming Learner')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollmentId,
            'lesson_id' => $lessonId,
            'progress_pct' => 50,
        ])
        ->assertOk();
});
