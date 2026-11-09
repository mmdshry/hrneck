<?php

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
    $this->user = orgAdmin();
    $this->tenant = Tenant::query()->findOrFail('itneck');
});

function asTenantOrg($test): mixed
{
    return $test->actingAs($test->user)->withHeader('X-Tenant', 'itneck');
}

function asMatchingLearner($test, string $email, string $name): mixed
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

test('org can create course lesson upload media and track lesson progress', function () {
    Storage::fake('local');

    $create = asTenantOrg($this)
        ->postJson('/api/v1/org/training/courses', [
            'title' => 'Custom awareness',
            'description' => 'Uploaded content course',
            'duration_minutes' => 12,
        ])
        ->assertCreated()
        ->json('data');

    $courseId = $create['id'];

    $upload = asTenantOrg($this)
        ->post('/api/v1/org/training/media/upload', [
            'content_type' => 'pdf',
            'file' => UploadedFile::fake()->create('guide.pdf', 120, 'application/pdf'),
        ], ['X-Tenant' => 'itneck'])
        ->assertCreated()
        ->json('data');

    expect($upload['media_disk_path'])->not->toBeEmpty();
    Storage::disk('local')->assertExists($upload['media_disk_path']);

    $lesson = asTenantOrg($this)
        ->postJson("/api/v1/org/training/courses/{$courseId}/lessons", [
            'title' => 'Policy PDF',
            'content_type' => 'pdf',
            'media_disk_path' => $upload['media_disk_path'],
            'media_mime' => $upload['media_mime'],
            'media_size' => $upload['media_size'],
        ])
        ->assertCreated()
        ->json('data');

    Tenancy::initialize($this->tenant);
    $target = Target::query()->firstOrFail();
    $targetEmail = $target->email;
    $enrollment = Enrollment::query()->create([
        'course_id' => $courseId,
        'target_id' => $target->id,
        'status' => 'assigned',
        'progress' => 0,
        'source' => 'manual',
    ]);
    Tenancy::end();

    asMatchingLearner($this, $targetEmail, 'Lesson Learner')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollment->id,
            'lesson_id' => $lesson['id'],
            'completed' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.lesson_progress.status', 'completed')
        ->assertJsonPath('data.enrollment.status', 'completed')
        ->assertJsonPath('data.enrollment.progress', 100);

    Tenancy::initialize($this->tenant);
    expect(LessonProgress::query()->where('enrollment_id', $enrollment->id)->where('status', 'completed')->count())->toBe(1);
    Tenancy::end();
});

test('video progress completes at eighty percent and quiz pass syncs campaign recipient', function () {
    Tenancy::initialize($this->tenant);
    $course = Course::query()->create([
        'title' => 'Video course',
        'description' => 'Watch then quiz',
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $lesson = Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Clip',
        'content_type' => 'video',
        'body' => '',
        'media_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'duration_seconds' => 100,
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
    $targetEmail = $target->email;
    $enrollment = Enrollment::query()->create([
        'course_id' => $course->id,
        'target_id' => $target->id,
        'status' => 'assigned',
        'progress' => 0,
        'source' => 'manual',
    ]);
    $campaign = Campaign::query()->create([
        'name' => 'Video wave',
        'type' => 'training',
        'status' => 'running',
        'course_id' => $course->id,
    ]);
    $recipient = CampaignRecipient::query()->create([
        'campaign_id' => $campaign->id,
        'target_id' => $target->id,
        'tracking_token' => 'itneck.train.'.Str::random(24),
        'status' => 'sent',
        'sent_at' => now(),
    ]);
    $courseId = $course->id;
    $lessonId = $lesson->id;
    $enrollmentId = $enrollment->id;
    $quizId = $quiz->id;
    $targetId = $target->id;
    $recipientId = $recipient->id;
    Tenancy::end();

    asMatchingLearner($this, $targetEmail, 'Video Learner')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollmentId,
            'lesson_id' => $lessonId,
            'watched_seconds' => 80,
            'progress_pct' => 80,
        ])
        ->assertOk()
        ->assertJsonPath('data.lesson_progress.status', 'completed');

    Tenancy::initialize($this->tenant);
    $enrollment = Enrollment::query()->findOrFail($enrollmentId);
    expect($enrollment->status)->toBe('in_progress')
        ->and($enrollment->progress)->toBe(100)
        ->and($enrollment->opened_at)->not->toBeNull();
    $recipient = CampaignRecipient::query()->findOrFail($recipientId);
    expect($recipient->opened_at)->not->toBeNull();
    Tenancy::end();

    asMatchingLearner($this, $targetEmail, 'Video Learner')
        ->postJson('/api/v1/org/training/quiz', [
            'quiz_id' => $quizId,
            'target_id' => $targetId,
            'enrollment_id' => $enrollmentId,
            'answers' => [0],
        ])
        ->assertOk()
        ->assertJsonPath('data.passed', true)
        ->assertJsonPath('data.enrollment.status', 'completed');

    Tenancy::initialize($this->tenant);
    expect(CampaignRecipient::query()->findOrFail($recipientId)->status)->toBe('completed');
    expect(Enrollment::query()->findOrFail($enrollmentId)->status)->toBe('completed');
    Tenancy::end();

    $dash = asTenantOrg($this)
        ->getJson('/api/v1/org/campaigns/dashboard?type=training')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                'enrollments_total',
                'enrollments_completed',
                'enrollments_in_progress',
                'opened_pct',
                'completed_pct',
            ],
        ])
        ->json('data');

    expect($dash['enrollments_total'])->toBeGreaterThanOrEqual(1)
        ->and($dash['enrollments_completed'])->toBeGreaterThanOrEqual(1);
});

test('assignments without a matching learner profile return a short forbidden message', function () {
    // Tenant databases are not rolled back between tests, and other features
    // attach the demo org admin to a learner target. Use a fresh account.
    Tenancy::end();

    $user = app(CreateOrgUser::class)->handle(
        'itneck',
        'No Profile Learner',
        'no-profile-'.Str::lower((string) Str::uuid()).'@itneck.test',
        'DemoPass!234',
        ['org_admin'],
    );

    $response = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/training/assignments')
        ->assertForbidden()
        ->assertJsonPath('message', 'No assigned training found for this account yet.');

    expect($response->getContent())
        ->not->toContain('vendor')
        ->not->toContain('trace');
});
