<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Realtime\Snapshots\LiveSnapshotBuilder;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use App\Domains\TrainingLms\Models\TrainingAttestation;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Str;
use Stancl\Tenancy\Facades\Tenancy;

/**
 * Creates a course with one text lesson (and optionally one required quiz) for the
 * seeded learner target, and returns the ids the tests need.
 *
 * @return array{course: int, lesson: int, quiz: ?int, enrollment: int, email: string}
 */
function attestationFixture(bool $withRequiredQuiz): array
{
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $course = Course::query()->create([
        'title' => 'Attestation '.Str::lower(Str::random(8)),
        'description' => 'Attestation course',
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $lesson = Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Policy',
        'content_type' => 'text',
        'body' => 'Read the policy.',
        'sort_order' => 1,
    ]);

    $quizId = null;
    if ($withRequiredQuiz) {
        $quiz = Quiz::query()->create([
            'course_id' => $course->id,
            'title' => 'Check',
            'pass_score' => 70,
            'is_required' => true,
        ]);
        QuizQuestion::query()->create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Ok?',
            'options' => ['Yes', 'No'],
            'correct_index' => 0,
        ]);
        $quizId = $quiz->id;
    }

    $target = Target::query()->firstOrFail();
    $enrollment = Enrollment::query()->create([
        'course_id' => $course->id,
        'target_id' => $target->id,
        'status' => 'assigned',
        'progress' => 0,
        'source' => 'manual',
    ]);

    $fixture = [
        'course' => $course->id,
        'lesson' => $lesson->id,
        'quiz' => $quizId,
        'enrollment' => $enrollment->id,
        'email' => $target->email,
    ];

    Tenancy::end();

    return $fixture;
}

function attestationLearner(string $email): User
{
    $user = User::query()->where('email', $email)->first();
    if ($user) {
        return $user;
    }

    return app(CreateOrgUser::class)->handle(
        'itneck',
        'Attestation Learner',
        $email,
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );
}

function attestationAs(object $test, string $email): mixed
{
    return $test->actingAs(attestationLearner($email))->withHeader('X-Tenant', 'itneck');
}

function completeAttestationLesson(object $test, array $fixture): void
{
    attestationAs($test, $fixture['email'])
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $fixture['enrollment'],
            'lesson_id' => $fixture['lesson'],
            'completed' => true,
        ])
        ->assertOk();
}

test('course completion waits for the learner attestation and writes an audit record', function () {
    $fixture = attestationFixture(withRequiredQuiz: false);

    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $fixture['enrollment'],
            'lesson_id' => $fixture['lesson'],
            'completed' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.enrollment.status', 'in_progress')
        ->assertJsonPath('data.enrollment.attestation_pending', true)
        ->assertJsonPath('data.enrollment.attested_at', null);

    attestationAs($this, $fixture['email'])
        ->withHeader('User-Agent', 'AttestationTest/1.0')
        ->postJson('/api/v1/org/training/attestation', [
            'enrollment_id' => $fixture['enrollment'],
            'accepted' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.attestation_pending', false);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $enrollment = Enrollment::query()->findOrFail($fixture['enrollment']);
    expect($enrollment->status)->toBe('completed')
        ->and($enrollment->attested_at)->not->toBeNull()
        ->and($enrollment->attestation_pending)->toBeFalse();

    $audit = TrainingAttestation::query()->where('enrollment_id', $fixture['enrollment'])->sole();
    expect($audit->course_id)->toBe($fixture['course'])
        ->and($audit->text_version)->toBe(TrainingAttestation::TEXT_VERSION)
        ->and($audit->ip_address)->not->toBeNull()
        ->and($audit->user_agent)->toBe('AttestationTest/1.0')
        ->and($audit->accepted_at)->not->toBeNull();
    Tenancy::end();
});

test('attestation is refused until every lesson and required quiz is done', function () {
    $fixture = attestationFixture(withRequiredQuiz: true);

    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/attestation', [
            'enrollment_id' => $fixture['enrollment'],
            'accepted' => true,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['attestation']);

    // The lesson is done but the required quiz is not passed yet.
    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $fixture['enrollment'],
            'lesson_id' => $fixture['lesson'],
            'completed' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.enrollment.attestation_pending', false);

    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/attestation', [
            'enrollment_id' => $fixture['enrollment'],
            'accepted' => true,
        ])
        ->assertStatus(422);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(TrainingAttestation::query()->where('enrollment_id', $fixture['enrollment'])->exists())->toBeFalse()
        ->and(Enrollment::query()->findOrFail($fixture['enrollment'])->status)->toBe('in_progress');
    Tenancy::end();
});

test('accepting the attestation twice records a single audit row', function () {
    $fixture = attestationFixture(withRequiredQuiz: false);
    completeAttestationLesson($this, $fixture);

    foreach ([1, 2] as $_) {
        attestationAs($this, $fixture['email'])
            ->postJson('/api/v1/org/training/attestation', [
                'enrollment_id' => $fixture['enrollment'],
                'accepted' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
    }

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(TrainingAttestation::query()->where('enrollment_id', $fixture['enrollment'])->count())->toBe(1);
    Tenancy::end();
});

test('attestation requires the accepted flag to be true', function () {
    $fixture = attestationFixture(withRequiredQuiz: false);
    completeAttestationLesson($this, $fixture);

    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/attestation', [
            'enrollment_id' => $fixture['enrollment'],
            'accepted' => false,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['accepted']);
});

test('the progress endpoint cannot complete a course without the attestation', function () {
    $fixture = attestationFixture(withRequiredQuiz: false);

    // Claiming 100% before the lesson is done must not complete the course.
    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/progress', [
            'enrollment_id' => $fixture['enrollment'],
            'progress' => 100,
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_progress')
        ->assertJsonPath('data.attestation_pending', false);

    completeAttestationLesson($this, $fixture);

    // Everything is done, but without the attestation the course stays open.
    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/progress', [
            'enrollment_id' => $fixture['enrollment'],
            'progress' => 100,
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_progress')
        ->assertJsonPath('data.attestation_pending', true);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Enrollment::query()->findOrFail($fixture['enrollment'])->status)->toBe('in_progress');
    Tenancy::end();
});

test('courses completed before the attestation feature keep their completion', function () {
    $fixture = attestationFixture(withRequiredQuiz: false);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    LessonProgress::query()->create([
        'enrollment_id' => $fixture['enrollment'],
        'lesson_id' => $fixture['lesson'],
        'status' => 'completed',
        'progress_pct' => 100,
        'watched_seconds' => 0,
        'opened_at' => now(),
        'completed_at' => now(),
    ]);
    Enrollment::query()->whereKey($fixture['enrollment'])->update([
        'status' => 'completed',
        'progress' => 100,
        'opened_at' => now(),
        'completed_at' => now(),
    ]);
    Tenancy::end();

    attestationAs($this, $fixture['email'])
        ->postJson('/api/v1/org/training/progress', [
            'enrollment_id' => $fixture['enrollment'],
            'progress' => 100,
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.attestation_pending', false);
});

test('learner live snapshot carries the attestation state', function () {
    $fixture = attestationFixture(withRequiredQuiz: false);
    $userId = attestationLearner($fixture['email'])->id;
    completeAttestationLesson($this, $fixture);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $snapshot = app(LiveSnapshotBuilder::class)->forLearnUser($userId);
    $row = collect($snapshot['data'])->firstWhere('id', $fixture['enrollment']);
    Tenancy::end();

    expect($row)->not->toBeNull()
        ->and($row['attestation_pending'])->toBeTrue()
        ->and($row['attested_at'])->toBeNull();
});
