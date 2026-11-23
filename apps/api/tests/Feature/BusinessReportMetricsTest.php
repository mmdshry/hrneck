<?php

use App\Domains\AnalyticsReporting\Actions\BuildBusinessReportMetrics;
use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\Campaigns\Actions\LaunchTrainingCampaign;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\Campaigns\Models\TrainingAssignmentEvent;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Actions\SyncEnrollmentProgress;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizAttempt;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    DB::table('organization_settings')->updateOrInsert(
        ['id' => 1],
        [
            'display_name' => 'Component Surfaces',
            'primary_color' => '#083a6d',
            'timezone' => 'UTC',
            'updated_at' => now(),
            'created_at' => now(),
        ],
    );
});

afterEach(function () {
    Carbon::setTestNow();
    if (tenant() !== null) {
        Tenancy::end();
    }
});

/**
 * @param  list<array{type: string, at: string}>  $events
 */
function insertTrainingAssignmentFact(array $overrides, array $events): void
{
    $assignment = TrainingAssignment::query()->create(array_merge([
        'campaign_name' => 'Campaign',
        'course_title' => 'Course',
        'target_name' => 'Learner',
        'target_email' => 'learner-'.uniqid('', true).'@example.test',
        'group_name' => 'Component Surfaces',
        'is_remedial' => false,
        'status' => 'no_action',
    ], $overrides));

    foreach ($events as $event) {
        TrainingAssignmentEvent::query()->create([
            'training_assignment_id' => $assignment->id,
            'type' => $event['type'],
            'occurred_at' => $event['at'],
        ]);
    }
}

test('monthly business report matches the sample training totals', function () {
    for ($i = 1; $i <= 100; $i++) {
        $events = [['type' => 'sent', 'at' => '2025-12-10 12:00:00']];
        if ($i <= 53) {
            $events[] = ['type' => 'passed', 'at' => '2025-12-12 12:00:00'];
        } elseif ($i <= 58) {
            $events[] = ['type' => 'started', 'at' => '2025-12-11 12:00:00'];
        }

        insertTrainingAssignmentFact([
            'campaign_name' => 'December wave',
            'course_title' => 'Prior course',
            'target_name' => 'December '.$i,
            'group_name' => 'Component Surfaces',
        ], $events);
    }

    insertTrainingAssignmentFact([
        'campaign_name' => 'Component Surfaces - December Training',
        'course_title' => 'Business Email Compromise',
        'target_name' => 'Idle A',
    ], [['type' => 'sent', 'at' => '2026-01-04 12:00:00']]);
    insertTrainingAssignmentFact([
        'campaign_name' => 'Component Surfaces - December Training',
        'course_title' => 'Business Email Compromise',
        'target_name' => 'Passed Person',
    ], [
        ['type' => 'sent', 'at' => '2026-01-04 12:00:00'],
        ['type' => 'passed', 'at' => '2026-01-06 12:00:00'],
    ]);

    for ($i = 1; $i <= 12; $i++) {
        insertTrainingAssignmentFact([
            'campaign_name' => 'Component Surfaces - January',
            'course_title' => 'Physical Office Security',
            'target_name' => $i === 1 ? 'Idle Person' : 'Office '.$i,
        ], [['type' => 'sent', 'at' => '2026-01-05 12:00:00']]);
    }
    for ($i = 1; $i <= 3; $i++) {
        insertTrainingAssignmentFact([
            'campaign_name' => 'Component Surfaces - January',
            'course_title' => 'Physical Office Security',
            'target_name' => 'Office passed '.$i,
        ], [
            ['type' => 'sent', 'at' => '2026-01-05 12:00:00'],
            ['type' => 'passed', 'at' => '2026-01-08 12:00:00'],
        ]);
    }

    insertTrainingAssignmentFact([
        'campaign_name' => 'Remedial Wave',
        'course_title' => 'Remedial Course',
        'target_name' => 'High Risk',
        'target_email' => 'high.risk@componentsurfaces.com',
        'is_remedial' => true,
    ], [['type' => 'sent', 'at' => '2026-01-09 12:00:00']]);

    $report = app(BuildBusinessReportMetrics::class)->handle('2026-01', 'UTC');

    expect($report['title'])->toBe('Monthly Business Report')
        ->and($report['organization'])->toBe('Component Surfaces')
        ->and($report['training']['campaigns'])->toBe(2)
        ->and($report['training']['assigned'])->toBe(17)
        ->and($report['training']['statuses']['no_action']['current'])->toBe(76)
        ->and($report['training']['statuses']['no_action']['previous'])->toBe(42)
        ->and($report['training']['statuses']['no_action']['delta'])->toBe(34)
        ->and($report['training']['statuses']['incomplete']['current'])->toBe(0)
        ->and($report['training']['statuses']['incomplete']['previous'])->toBe(5)
        ->and($report['training']['statuses']['incomplete']['delta'])->toBe(-5)
        ->and($report['training']['statuses']['failed']['current'])->toBe(0)
        ->and($report['training']['statuses']['failed']['previous'])->toBe(0)
        ->and($report['training']['statuses']['failed']['delta'])->toBe(0)
        ->and($report['training']['statuses']['passed']['current'])->toBe(24)
        ->and($report['training']['statuses']['passed']['previous'])->toBe(53)
        ->and($report['training']['statuses']['passed']['delta'])->toBe(-29)
        ->and($report['training']['current_month_labels'])->toBe(['Jan'])
        ->and($report['training']['previous_month_labels'])->toBe(['Dec'])
        ->and($report['training']['details']['emails_sent'])->toBe(17)
        ->and($report['training']['details']['courses'])->toBe(2)
        ->and($report['training']['details']['counts'])->toBe([
            'no_action' => 13,
            'incomplete' => 0,
            'failed' => 0,
            'passed' => 4,
        ])
        ->and($report['training']['details']['rows'][0])->toMatchArray([
            'campaign' => 'Component Surfaces - December Training',
            'course' => 'Business Email Compromise',
            'group' => 'Component Surfaces',
            'assigned' => 2,
            'no_action_pct' => 50,
            'no_action' => 1,
            'passed_pct' => 50,
            'passed' => 1,
        ])
        ->and($report['training']['details']['rows'][1])->toMatchArray([
            'campaign' => 'Component Surfaces - January',
            'course' => 'Physical Office Security',
            'assigned' => 15,
            'no_action_pct' => 80,
            'no_action' => 12,
            'passed_pct' => 20,
            'passed' => 3,
        ])
        ->and($report['training']['risk']['mode'])->toBe('users')
        ->and($report['training']['risk']['users'])->toHaveCount(13)
        ->and(collect($report['training']['risk']['users'])->pluck('name')->all())->toContain('Idle Person')
        ->and(collect($report['training']['risk']['users'])->pluck('name')->all())->not->toContain('Passed Person')
        ->and($report['remedial']['empty'])->toBeFalse()
        ->and($report['remedial']['high_risk_users'])->toBe(1)
        ->and($report['remedial']['rows'][0]['enrollments'])->toBe(1);

    $html = view('reports.quarterly', ['report' => $report])->render();
    expect($html)->toContain('Training &amp; Awareness')
        ->and($html)->toContain('Users by Risk Level')
        ->and($html)->toContain('prepared for Component Surfaces')
        ->and($html)->toContain('unauthorized use is strictly prohibited')
        ->and($html)->toContain('76%')
        ->and($html)->toContain('+34%')
        ->and($html)->toContain('alt="HRneck"')
        ->and($html)->toContain('data:image/png;base64,')
        ->and($html)->toContain('aria-label="No action"')
        ->and($html)->toContain('aria-label="Passed"')
        ->and($html)->not->toContain('hrneck-mark.png')
        ->and($html)->not->toContain('M115.0 2.0')
        ->and($html)->toContain('#083A6D')
        ->and($html)->toContain('#F76B13')
        ->and($html)->not->toContain('page-break-after')
        ->and(substr_count($html, 'class="page"'))->toBe(5)
        ->and($html)->not->toContain('Phishing Simulation')
        ->and($html)->not->toContain('Phished Users')
        ->and($html)->not->toContain('Training Courses by Risk Level');

    Storage::fake('local');
    $built = app(BuildQuarterlyPdfReport::class)->handle('2026-01', 'business', [
        'timezone' => 'UTC',
        'period_type' => 'monthly',
    ]);
    $binary = Storage::disk('local')->get($built['path']);
    preg_match_all('/\/Type\s*\/Page(?!s)/', (string) $binary, $pageMatches);
    expect($binary)->toStartWith('%PDF')
        ->and($binary)->toContain('/MediaBox [0.000 0.000 841.890 595.280]')
        ->and(count($pageMatches[0]))->toBe(6);
});

test('quarterly business report ranks courses by the sample completion rates', function () {
    for ($i = 1; $i <= 123; $i++) {
        $passed = $i <= 16;
        insertTrainingAssignmentFact([
            'campaign_name' => 'Security Awareness Training',
            'course_title' => 'AI Deception: Recognizing Deepfake Scams',
            'group_name' => $i <= 60 ? 'PB Strat' : 'cellaxys',
            'target_name' => 'AI '.$i,
        ], $passed
            ? [
                ['type' => 'sent', 'at' => '2026-07-02 12:00:00'],
                ['type' => 'passed', 'at' => '2026-07-20 12:00:00'],
            ]
            : [['type' => 'sent', 'at' => '2026-07-02 12:00:00']]);
    }

    insertTrainingAssignmentFact([
        'campaign_name' => 'Security Awareness Training',
        'course_title' => 'Mobile Security: Mobile Wi-Fi Security',
        'group_name' => 'PB Strat',
        'target_name' => 'Mobile passed',
    ], [
        ['type' => 'sent', 'at' => '2026-07-03 12:00:00'],
        ['type' => 'passed', 'at' => '2026-07-21 12:00:00'],
    ]);
    insertTrainingAssignmentFact([
        'campaign_name' => 'Security Awareness Training',
        'course_title' => 'Mobile Security: Mobile Wi-Fi Security',
        'group_name' => 'primmed',
        'target_name' => 'Mobile idle',
    ], [['type' => 'sent', 'at' => '2026-07-03 12:00:00']]);

    for ($i = 1; $i <= 3; $i++) {
        insertTrainingAssignmentFact([
            'campaign_name' => 'Security Awareness Training',
            'course_title' => 'The Dangers of AI-Generated Phishing',
            'group_name' => 'PB Strat',
            'target_name' => 'Danger passed '.$i,
        ], [
            ['type' => 'sent', 'at' => '2026-07-04 12:00:00'],
            ['type' => 'passed', 'at' => '2026-07-22 12:00:00'],
        ]);
    }
    for ($i = 1; $i <= 2; $i++) {
        insertTrainingAssignmentFact([
            'campaign_name' => 'Security Awareness Training',
            'course_title' => 'The Dangers of AI-Generated Phishing',
            'group_name' => 'thesanctuarynv',
            'target_name' => 'Danger idle '.$i,
        ], [['type' => 'sent', 'at' => '2026-07-04 12:00:00']]);
    }

    $report = app(BuildBusinessReportMetrics::class)->handle('2026-Q3', 'UTC');
    $courses = $report['training']['risk']['courses'];

    expect($report['period_type'])->toBe('quarterly')
        ->and($report['training']['current_month_labels'])->toBe(['Jul', 'Aug', 'Sep'])
        ->and($report['training']['previous_month_labels'])->toBe(['Apr', 'May', 'Jun'])
        ->and($report['training']['assigned'])->toBe(130)
        ->and($report['training']['statuses']['no_action']['current_months'])->toBe([85, 0, 0])
        ->and($report['training']['statuses']['no_action']['previous_months'])->toBe([0, 0, 0])
        ->and($report['training']['statuses']['no_action']['delta'])->toBe(85)
        ->and($report['training']['risk']['mode'])->toBe('courses')
        ->and($report['training']['risk']['truncated'])->toBeFalse()
        ->and($courses[0])->toMatchArray([
            'course' => 'AI Deception: Recognizing Deepfake Scams',
            'groups_targeted' => 2,
            'users_targeted' => 123,
            'incomplete_or_no_action' => 107,
            'failed' => 0,
            'completion_rate' => 13,
        ])
        ->and($courses[1])->toMatchArray([
            'course' => 'Mobile Security: Mobile Wi-Fi Security',
            'groups_targeted' => 2,
            'users_targeted' => 2,
            'incomplete_or_no_action' => 1,
            'failed' => 0,
            'completion_rate' => 50,
        ])
        ->and($courses[2])->toMatchArray([
            'course' => 'The Dangers of AI-Generated Phishing',
            'groups_targeted' => 2,
            'users_targeted' => 5,
            'incomplete_or_no_action' => 2,
            'failed' => 0,
            'completion_rate' => 60,
        ]);

    $html = view('reports.quarterly', ['report' => $report])->render();
    expect($html)->toContain('Training Courses by Risk Level')
        ->and($html)->toContain('No results found')
        ->and($html)->toContain('alt="HRneck"')
        ->and($html)->toContain('aria-label="No action"')
        ->and($html)->not->toContain('hrneck-mark.png')
        ->and($html)->not->toContain('page-break-after')
        ->and($html)->not->toContain('Users by Risk Level')
        ->and($html)->not->toContain('Phishing Simulation');

    Storage::fake('local');
    $built = app(BuildQuarterlyPdfReport::class)->handle('2026-Q3', 'business', [
        'timezone' => 'UTC',
        'period_type' => 'quarterly',
    ]);
    expect(Storage::disk('local')->get($built['path']))->toStartWith('%PDF');
});

test('course risk rollup stops at 150 courses', function () {
    for ($i = 0; $i <= 150; $i++) {
        insertTrainingAssignmentFact([
            'campaign_name' => 'Bulk',
            'course_title' => sprintf('Course %03d', $i),
            'target_name' => 'Learner '.$i,
        ], [['type' => 'sent', 'at' => '2026-07-01 12:00:00']]);
    }

    $report = app(BuildBusinessReportMetrics::class)->handle('2026-07', 'UTC');
    $titles = collect($report['training']['risk']['courses'])->pluck('course');

    expect($report['training']['risk']['mode'])->toBe('courses')
        ->and($report['training']['risk']['truncated'])->toBeTrue()
        ->and($report['training']['risk']['courses'])->toHaveCount(150)
        ->and($titles->first())->toBe('Course 000')
        ->and($titles->contains('Course 150'))->toBeFalse();
});

test('launch freezes the group and name from the moment of send', function () {
    Mail::fake();
    Carbon::setTestNow('2026-01-05 15:00:00');

    $course = Course::query()->create([
        'title' => 'Physical Office Security',
        'description' => null,
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Locks',
        'content_type' => 'text',
        'body' => 'Lock the door.',
        'sort_order' => 1,
    ]);
    $target = Target::query()->create([
        'email' => 'mpadilla@componentsurfaces.com',
        'first_name' => 'Marisela',
        'last_name' => 'Padilla',
        'status' => 'active',
    ]);
    $group = Group::query()->create([
        'name' => 'Component Surfaces',
        'source' => 'manual',
    ]);
    $group->targets()->sync([$target->id]);

    $campaign = Campaign::query()->create([
        'name' => 'Component Surfaces - January',
        'type' => 'training',
        'status' => 'draft',
        'course_id' => $course->id,
    ]);
    app(LaunchTrainingCampaign::class)->handle($campaign, [$target->id], [$group->id]);

    $course->update(['title' => 'Renamed course']);
    $group->update(['name' => 'Renamed group']);
    $target->delete();

    $report = app(BuildBusinessReportMetrics::class)->handle('2026-01', 'UTC');
    $row = $report['training']['details']['rows'][0];
    $user = $report['training']['risk']['users'][0];

    expect($row['course'])->toBe('Physical Office Security')
        ->and($row['group'])->toBe('Component Surfaces')
        ->and($row['campaign'])->toBe('Component Surfaces - January')
        ->and($user['name'])->toBe('Marisela Padilla')
        ->and($user['email'])->toBe('mpadilla@componentsurfaces.com')
        ->and($user['date'])->toBe('01/05/2026')
        ->and($user['status'])->toBe('no_action');
});

test('a second campaign for the same course keeps its own outcome', function () {
    Mail::fake();
    Carbon::setTestNow('2026-01-05 15:00:00');

    $course = Course::query()->create([
        'title' => 'Shared course',
        'description' => null,
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $lesson = Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Lesson',
        'content_type' => 'text',
        'body' => 'Body',
        'sort_order' => 1,
    ]);
    $target = Target::query()->create([
        'email' => 'shared.course@componentsurfaces.com',
        'first_name' => 'Shared',
        'last_name' => 'Learner',
        'status' => 'active',
    ]);

    foreach (['First wave', 'Second wave'] as $name) {
        $campaign = Campaign::query()->create([
            'name' => $name,
            'type' => 'training',
            'status' => 'draft',
            'course_id' => $course->id,
        ]);
        app(LaunchTrainingCampaign::class)->handle($campaign, [$target->id]);
    }

    $enrollment = Enrollment::query()->where('course_id', $course->id)->where('target_id', $target->id)->firstOrFail();
    LessonProgress::query()->create([
        'enrollment_id' => $enrollment->id,
        'lesson_id' => $lesson->id,
        'status' => 'completed',
        'progress_pct' => 100,
        'completed_at' => now(),
    ]);
    app(SyncEnrollmentProgress::class)->recompute($enrollment->fresh(['course.lessons', 'course.quizzes']));

    $assignments = TrainingAssignment::query()->orderBy('id')->get();
    expect($assignments)->toHaveCount(2)
        ->and($assignments[0]->events()->pluck('type')->all())->toBe(['sent'])
        ->and($assignments[1]->events()->orderBy('occurred_at')->pluck('type')->all())->toBe(['sent', 'passed']);
});

test('a january failure stays failed after a february pass', function () {
    Mail::fake();
    Carbon::setTestNow('2026-01-15 12:00:00');

    $course = Course::query()->create([
        'title' => 'Quiz course',
        'description' => null,
        'duration_minutes' => 5,
        'is_sample' => false,
    ]);
    $lesson = Lesson::query()->create([
        'course_id' => $course->id,
        'title' => 'Lesson',
        'content_type' => 'text',
        'body' => 'Body',
        'sort_order' => 1,
    ]);
    $quiz = Quiz::query()->create([
        'course_id' => $course->id,
        'title' => 'Check',
        'pass_score' => 70,
        'is_required' => true,
    ]);
    $target = Target::query()->create([
        'email' => 'quiz.learner@componentsurfaces.com',
        'first_name' => 'Quiz',
        'last_name' => 'Learner',
        'status' => 'active',
    ]);
    $campaign = Campaign::query()->create([
        'name' => 'Quiz wave',
        'type' => 'training',
        'status' => 'draft',
        'course_id' => $course->id,
    ]);
    app(LaunchTrainingCampaign::class)->handle($campaign, [$target->id]);

    $enrollment = Enrollment::query()->where('target_id', $target->id)->where('course_id', $course->id)->firstOrFail();
    LessonProgress::query()->create([
        'enrollment_id' => $enrollment->id,
        'lesson_id' => $lesson->id,
        'status' => 'completed',
        'progress_pct' => 100,
        'completed_at' => now(),
    ]);

    Carbon::setTestNow('2026-01-20 12:00:00');
    QuizAttempt::query()->create([
        'quiz_id' => $quiz->id,
        'target_id' => $target->id,
        'score' => 10,
        'passed' => false,
        'answers' => [1],
    ]);
    app(SyncEnrollmentProgress::class)->recompute($enrollment->fresh(['course.lessons', 'course.quizzes']));

    Carbon::setTestNow('2026-02-10 12:00:00');
    QuizAttempt::query()->create([
        'quiz_id' => $quiz->id,
        'target_id' => $target->id,
        'score' => 100,
        'passed' => true,
        'answers' => [0],
    ]);
    app(SyncEnrollmentProgress::class)->recompute($enrollment->fresh(['course.lessons', 'course.quizzes']));

    $january = app(BuildBusinessReportMetrics::class)->handle('2026-01', 'UTC');
    $february = app(BuildBusinessReportMetrics::class)->handle('2026-02', 'UTC');
    $types = TrainingAssignmentEvent::query()->orderBy('occurred_at')->pluck('type')->all();

    expect($types)->toBe(['sent', 'failed', 'passed'])
        ->and($january['training']['statuses']['failed']['current'])->toBe(100)
        ->and($january['training']['statuses']['passed']['current'])->toBe(0)
        ->and($january['training']['risk']['users'][0]['status'])->toBe('failed')
        ->and($february['training']['statuses']['passed']['current'])->toBe(100)
        ->and($february['training']['statuses']['failed']['current'])->toBe(0)
        ->and($february['training']['risk']['users'])->toBe([]);
});
