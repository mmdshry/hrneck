<?php

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Stancl\Tenancy\Facades\Tenancy;

beforeEach(function () {
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

test('lesson media_disk_path outside training prefix is rejected', function () {
    $create = asTenantOrg($this)
        ->postJson('/api/v1/org/training/courses', [
            'title' => 'Path Guard',
            'description' => 'Reject foreign paths',
            'duration_minutes' => 3,
        ])
        ->assertCreated()
        ->json('data');

    asTenantOrg($this)
        ->postJson("/api/v1/org/training/courses/{$create['id']}/lessons", [
            'title' => 'Bad path',
            'content_type' => 'document',
            'media_disk_path' => 'imports/targets/steal-me.csv',
            'media_mime' => 'text/csv',
            'media_size' => 12,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['media_disk_path']);
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

test('training managers can preview media without enrollment and learners cannot', function () {
    Storage::fake('local');

    $create = asTenantOrg($this)
        ->postJson('/api/v1/org/training/courses', [
            'title' => 'Preview course',
            'description' => 'Admin preview',
            'duration_minutes' => 5,
        ])
        ->assertCreated()
        ->json('data');

    $upload = asTenantOrg($this)
        ->post('/api/v1/org/training/media/upload', [
            'content_type' => 'pdf',
            'file' => UploadedFile::fake()->create('preview.pdf', 64, 'application/pdf'),
        ], ['X-Tenant' => 'itneck'])
        ->assertCreated()
        ->json('data');

    $lesson = asTenantOrg($this)
        ->postJson("/api/v1/org/training/courses/{$create['id']}/lessons", [
            'title' => 'Preview PDF',
            'content_type' => 'pdf',
            'media_disk_path' => $upload['media_disk_path'],
            'media_mime' => $upload['media_mime'],
            'media_size' => $upload['media_size'],
        ])
        ->assertCreated()
        ->json('data');

    asTenantOrg($this)
        ->get("/api/v1/org/training/media/{$lesson['id']}")
        ->assertOk()
        ->assertHeader('Accept-Ranges', 'bytes');

    $learner = app(CreateOrgUser::class)->handle(
        'itneck',
        'Preview Blocked Learner',
        'preview-blocked-'.Str::lower((string) Str::uuid()).'@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->get("/api/v1/org/training/media/{$lesson['id']}")
        ->assertForbidden();
});

test('uploaded training media supports byte range requests', function () {
    Storage::fake('local');

    $create = asTenantOrg($this)
        ->postJson('/api/v1/org/training/courses', [
            'title' => 'Range course',
            'description' => 'Byte range streaming',
            'duration_minutes' => 5,
        ])
        ->assertCreated()
        ->json('data');

    $payload = str_repeat('A', 4096);
    $uploadPath = 'tenants/itneck/training/'.Str::uuid()->toString().'.mp4';
    Storage::disk('local')->put($uploadPath, $payload);

    $lesson = asTenantOrg($this)
        ->postJson("/api/v1/org/training/courses/{$create['id']}/lessons", [
            'title' => 'Clip',
            'content_type' => 'video',
            'media_disk_path' => $uploadPath,
            'media_mime' => 'video/mp4',
            'media_size' => strlen($payload),
        ])
        ->assertCreated()
        ->json('data');

    $response = asTenantOrg($this)
        ->withHeaders(['Range' => 'bytes=0-99'])
        ->get("/api/v1/org/training/media/{$lesson['id']}")
        ->assertStatus(206)
        ->assertHeader('Accept-Ranges', 'bytes')
        ->assertHeader('Content-Range');

    expect(strlen($response->streamedContent()))->toBe(100);
});

test('deleting a course removes uploaded lesson media from disk', function () {
    Storage::fake('local');

    $create = asTenantOrg($this)
        ->postJson('/api/v1/org/training/courses', [
            'title' => 'Cleanup course',
            'description' => 'Delete removes files',
            'duration_minutes' => 5,
        ])
        ->assertCreated()
        ->json('data');

    $upload = asTenantOrg($this)
        ->post('/api/v1/org/training/media/upload', [
            'content_type' => 'pdf',
            'file' => UploadedFile::fake()->create('cleanup.pdf', 40, 'application/pdf'),
        ], ['X-Tenant' => 'itneck'])
        ->assertCreated()
        ->json('data');

    asTenantOrg($this)
        ->postJson("/api/v1/org/training/courses/{$create['id']}/lessons", [
            'title' => 'Cleanup PDF',
            'content_type' => 'pdf',
            'media_disk_path' => $upload['media_disk_path'],
            'media_mime' => $upload['media_mime'],
            'media_size' => $upload['media_size'],
        ])
        ->assertCreated();

    Storage::disk('local')->assertExists($upload['media_disk_path']);

    asTenantOrg($this)
        ->deleteJson("/api/v1/org/training/courses/{$create['id']}")
        ->assertOk()
        ->assertJsonPath('deleted', true);

    Storage::disk('local')->assertMissing($upload['media_disk_path']);
});

test('org can upload audio and document lesson media and rejects invalid mime', function () {
    Storage::fake('local');

    $course = asTenantOrg($this)
        ->postJson('/api/v1/org/training/courses', [
            'title' => 'Media types course',
            'description' => 'Audio and documents',
            'duration_minutes' => 10,
        ])
        ->assertCreated()
        ->json('data');

    $audioUpload = asTenantOrg($this)
        ->post('/api/v1/org/training/media/upload', [
            'content_type' => 'audio',
            'file' => UploadedFile::fake()->create('briefing.mp3', 80, 'audio/mpeg'),
        ], ['X-Tenant' => 'itneck'])
        ->assertCreated()
        ->json('data');

    expect($audioUpload['content_type'])->toBe('audio')
        ->and($audioUpload['media_disk_path'])->not->toBeEmpty();
    Storage::disk('local')->assertExists($audioUpload['media_disk_path']);

    asTenantOrg($this)
        ->postJson("/api/v1/org/training/courses/{$course['id']}/lessons", [
            'title' => 'Audio brief',
            'content_type' => 'audio',
            'media_disk_path' => $audioUpload['media_disk_path'],
            'media_mime' => $audioUpload['media_mime'],
            'media_size' => $audioUpload['media_size'],
            'duration_seconds' => 100,
        ])
        ->assertCreated()
        ->assertJsonPath('data.content_type', 'audio');

    $docUpload = asTenantOrg($this)
        ->post('/api/v1/org/training/media/upload', [
            'content_type' => 'document',
            'file' => UploadedFile::fake()->create('policy.txt', 20, 'text/plain'),
        ], ['X-Tenant' => 'itneck'])
        ->assertCreated()
        ->json('data');

    expect($docUpload['content_type'])->toBe('document');
    Storage::disk('local')->assertExists($docUpload['media_disk_path']);

    asTenantOrg($this)
        ->postJson("/api/v1/org/training/courses/{$course['id']}/lessons", [
            'title' => 'Policy text',
            'content_type' => 'document',
            'media_disk_path' => $docUpload['media_disk_path'],
            'media_mime' => $docUpload['media_mime'],
            'media_size' => $docUpload['media_size'],
        ])
        ->assertCreated()
        ->assertJsonPath('data.content_type', 'document');

    asTenantOrg($this)
        ->post('/api/v1/org/training/media/upload', [
            'content_type' => 'video',
            'file' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain'),
        ], ['X-Tenant' => 'itneck'])
        ->assertStatus(422);
});

test('audio progress completes at eighty percent', function () {
    Tenancy::initialize($this->tenant);
    $course = Course::query()->create([
        'title' => 'Audio course',
        'description' => 'Listen then done',
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $lesson = Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Clip',
        'content_type' => 'audio',
        'body' => '',
        'duration_seconds' => 100,
        'sort_order' => 1,
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
    $lessonId = $lesson->id;
    $enrollmentId = $enrollment->id;
    Tenancy::end();

    asMatchingLearner($this, $targetEmail, 'Audio Learner')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollmentId,
            'lesson_id' => $lessonId,
            'watched_seconds' => 80,
            'progress_pct' => 80,
        ])
        ->assertOk()
        ->assertJsonPath('data.lesson_progress.status', 'completed');
});

test('assignments without a matching learner profile return an empty list', function () {
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
        ->assertOk()
        ->assertJsonPath('data', []);

    expect($response->getContent())
        ->not->toContain('vendor')
        ->not->toContain('trace');
});
