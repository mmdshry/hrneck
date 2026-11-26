<?php

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Stancl\Tenancy\Facades\Tenancy;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * Creates a course with one text lesson inside the tenant and returns the ids the tests need.
 *
 * @return array{id: int, title: string, lesson: int}
 */
function campaignCoursesCreateCourse(string $label): array
{
    $title = $label.' '.Str::lower(Str::random(8));
    $course = Course::query()->create([
        'title' => $title,
        'description' => null,
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $lesson = Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Intro',
        'content_type' => 'text',
        'body' => 'Read this lesson.',
        'sort_order' => 1,
    ]);

    return ['id' => (int) $course->id, 'title' => $title, 'lesson' => (int) $lesson->id];
}

/**
 * Two courses (each with one lesson) and the seeded learner target.
 *
 * @return array{first: array{id: int, title: string, lesson: int}, second: array{id: int, title: string, lesson: int}, target: array{id: int, email: string}}
 */
function campaignCoursesFixture(): array
{
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $target = Target::query()->firstOrFail();
    $fixture = [
        'first' => campaignCoursesCreateCourse('Policy'),
        'second' => campaignCoursesCreateCourse('Safety'),
        'target' => ['id' => (int) $target->id, 'email' => (string) $target->email],
    ];

    Tenancy::end();

    return $fixture;
}

/**
 * Creates a campaign through the API as the org admin and returns its id.
 *
 * @param  list<int>  $courseIds
 */
function campaignCoursesCreate($test, array $courseIds, int $targetId, bool $launch): int
{
    return (int) $test->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Course list '.Str::lower(Str::random(8)),
            'type' => 'training',
            'course_ids' => $courseIds,
            'target_ids' => [$targetId],
            'launch' => $launch,
        ])
        ->assertCreated()
        ->json('data.id');
}

function campaignCoursesEnrollmentId(int $courseId, int $targetId): int
{
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $id = (int) Enrollment::query()
        ->where('course_id', $courseId)
        ->where('target_id', $targetId)
        ->value('id');

    Tenancy::end();

    return $id;
}

function campaignCoursesLearner(string $email): User
{
    return User::query()->where('email', $email)->first()
        ?? app(CreateOrgUser::class)->handle(
            'itneck',
            'Course Learner',
            $email,
            'DemoPass!234',
            [OrgPermissionCatalog::LEARNER],
        );
}

/**
 * Completes a course the way a learner does: finish the lesson, then accept the attestation.
 */
function campaignCoursesFinish($test, User $learner, int $enrollmentId, int $lessonId): void
{
    $test->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/progress/lesson', [
            'enrollment_id' => $enrollmentId,
            'lesson_id' => $lessonId,
            'completed' => true,
        ])
        ->assertOk();

    $test->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/attestation', [
            'enrollment_id' => $enrollmentId,
            'accepted' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed');
}

/**
 * Every message the array mailer stored that was addressed to $address.
 *
 * @return list<Email>
 */
function campaignCoursesMailTo(string $address): array
{
    /** @var ArrayTransport $transport */
    $transport = Mail::mailer()->getSymfonyTransport();

    return collect($transport->messages())
        ->map(fn (SentMessage $sent): mixed => $sent->getOriginalMessage())
        ->filter(fn (mixed $message): bool => $message instanceof Email
            && collect($message->getTo())->contains(fn (Address $to): bool => $to->getAddress() === $address))
        ->values()
        ->all();
}

test('courses can be attached, reordered and detached while the campaign is a draft', function () {
    $fixture = campaignCoursesFixture();
    $campaignId = campaignCoursesCreate($this, [$fixture['first']['id']], $fixture['target']['id'], launch: false);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/campaigns/{$campaignId}/courses", ['course_id' => $fixture['second']['id']])
        ->assertOk()
        ->assertJsonCount(2, 'data.courses')
        ->assertJsonPath('data.courses.1.id', $fixture['second']['id']);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->putJson("/api/v1/org/campaigns/{$campaignId}/courses/order", [
            'course_ids' => [$fixture['second']['id'], $fixture['first']['id']],
        ])
        ->assertOk()
        ->assertJsonPath('data.courses.0.id', $fixture['second']['id'])
        ->assertJsonPath('data.courses.1.id', $fixture['first']['id']);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson("/api/v1/org/campaigns/{$campaignId}/courses/{$fixture['second']['id']}")
        ->assertOk()
        ->assertJsonCount(1, 'data.courses')
        ->assertJsonPath('data.courses.0.id', $fixture['first']['id']);
});

test('a new campaign keeps its course_ids in the submitted order and still accepts a single course_id', function () {
    $fixture = campaignCoursesFixture();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Ordered '.Str::lower(Str::random(6)),
            'type' => 'training',
            'course_ids' => [$fixture['second']['id'], $fixture['first']['id']],
            'target_ids' => [$fixture['target']['id']],
            'launch' => false,
        ])
        ->assertCreated()
        ->assertJsonPath('data.courses.0.id', $fixture['second']['id'])
        ->assertJsonPath('data.courses.1.id', $fixture['first']['id']);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Legacy single '.Str::lower(Str::random(6)),
            'type' => 'training',
            'course_id' => $fixture['first']['id'],
            'target_ids' => [$fixture['target']['id']],
            'launch' => false,
        ])
        ->assertCreated()
        ->assertJsonCount(1, 'data.courses')
        ->assertJsonPath('data.courses.0.id', $fixture['first']['id']);
});

test('a reorder that drops or adds a course is rejected', function () {
    $fixture = campaignCoursesFixture();
    $campaignId = campaignCoursesCreate($this, [$fixture['first']['id'], $fixture['second']['id']], $fixture['target']['id'], launch: false);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->putJson("/api/v1/org/campaigns/{$campaignId}/courses/order", [
            'course_ids' => [$fixture['first']['id']],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['course_ids']);
});

test('a launched campaign refuses course changes', function () {
    $fixture = campaignCoursesFixture();
    $campaignId = campaignCoursesCreate($this, [$fixture['first']['id']], $fixture['target']['id'], launch: true);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/campaigns/{$campaignId}/courses", ['course_id' => $fixture['second']['id']])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->putJson("/api/v1/org/campaigns/{$campaignId}/courses/order", [
            'course_ids' => [$fixture['first']['id']],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson("/api/v1/org/campaigns/{$campaignId}/courses/{$fixture['first']['id']}")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $campaign = Campaign::query()->findOrFail($campaignId);
    expect($campaign->status)->toBe('running')
        ->and($campaign->courses()->count())->toBe(1);
    Tenancy::end();
});

test('launching two courses enrolls the learner in both and queues one reminder that lists both', function () {
    $fixture = campaignCoursesFixture();
    $campaignId = campaignCoursesCreate(
        $this,
        [$fixture['first']['id'], $fixture['second']['id']],
        $fixture['target']['id'],
        launch: true,
    );

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Campaign::query()->findOrFail($campaignId)->status)->toBe('running')
        ->and(CampaignRecipient::query()->where('campaign_id', $campaignId)->count())->toBe(1)
        ->and(CampaignRecipient::query()->where('campaign_id', $campaignId)->value('status'))->toBe('sent')
        ->and(TrainingAssignment::query()->where('campaign_id', $campaignId)->count())->toBe(2)
        ->and(Enrollment::query()
            ->where('target_id', $fixture['target']['id'])
            ->whereIn('course_id', [$fixture['first']['id'], $fixture['second']['id']])
            ->count())->toBe(2);
    Tenancy::end();

    $reminders = campaignCoursesMailTo($fixture['target']['email']);
    expect($reminders)->toHaveCount(1);

    $body = (string) $reminders[0]->getTextBody();
    expect($body)->toContain($fixture['first']['title'])
        ->and($body)->toContain($fixture['second']['title']);
});

test('a learner finishes a multi-course campaign only after every course is attested', function () {
    $fixture = campaignCoursesFixture();
    $campaignId = campaignCoursesCreate(
        $this,
        [$fixture['first']['id'], $fixture['second']['id']],
        $fixture['target']['id'],
        launch: true,
    );
    $learner = campaignCoursesLearner($fixture['target']['email']);
    $firstEnrollment = campaignCoursesEnrollmentId($fixture['first']['id'], $fixture['target']['id']);
    $secondEnrollment = campaignCoursesEnrollmentId($fixture['second']['id'], $fixture['target']['id']);

    campaignCoursesFinish($this, $learner, $firstEnrollment, $fixture['first']['lesson']);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(CampaignRecipient::query()->where('campaign_id', $campaignId)->value('status'))->not->toBe('completed')
        ->and(Campaign::query()->findOrFail($campaignId)->status)->toBe('running');
    Tenancy::end();

    campaignCoursesFinish($this, $learner, $secondEnrollment, $fixture['second']['lesson']);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(CampaignRecipient::query()->where('campaign_id', $campaignId)->value('status'))->toBe('completed')
        ->and(Campaign::query()->findOrFail($campaignId)->status)->toBe('completed');
    Tenancy::end();
});

test('a course held by a campaign as a later course cannot be deleted until it is detached', function () {
    $fixture = campaignCoursesFixture();
    $campaignId = campaignCoursesCreate($this, [$fixture['first']['id'], $fixture['second']['id']], $fixture['target']['id'], launch: false);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/training/courses/'.$fixture['second']['id'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['course']);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson("/api/v1/org/campaigns/{$campaignId}/courses/{$fixture['second']['id']}")
        ->assertOk();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/training/courses/'.$fixture['second']['id'])
        ->assertOk();
});

test('a learner cannot attach, reorder or detach campaign courses', function () {
    $fixture = campaignCoursesFixture();
    $campaignId = campaignCoursesCreate($this, [$fixture['first']['id']], $fixture['target']['id'], launch: false);

    $learner = app(CreateOrgUser::class)->handle(
        'itneck',
        'Course Permission Learner',
        'course-permission-'.Str::lower(Str::random(8)).'@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/campaigns/{$campaignId}/courses", ['course_id' => $fixture['second']['id']])
        ->assertForbidden();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson("/api/v1/org/campaigns/{$campaignId}/courses/order", [
            'course_ids' => [$fixture['first']['id']],
        ])
        ->assertForbidden();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson("/api/v1/org/campaigns/{$campaignId}/courses/{$fixture['first']['id']}")
        ->assertForbidden();
});
