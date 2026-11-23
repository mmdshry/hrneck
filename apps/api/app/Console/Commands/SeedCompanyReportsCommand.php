<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Stancl\Tenancy\Facades\Tenancy;

class SeedCompanyReportsCommand extends Command
{
    public const EMAIL_DOMAIN = 'company-report.test';

    public const EXTERNAL_PREFIX = 'company-report:';

    public const TITLE_PREFIX = '[Report Seed]';

    public const GROUP_SOURCE = 'company-report';

    protected $signature = 'hrneck:seed-company-reports
        {--fresh : Remove previously marked report-seed rows before seeding}
        {--targets=500 : Minimum number of report-seed employees}
        {--chunk=250 : Bulk insert chunk size}';

    protected $description = 'Seed company tenant with report-ready employees, quizzes, and dated training outcomes';

    /** @var list<string> */
    private array $departments = [
        'Engineering', 'Sales', 'HR', 'Finance', 'Support', 'Marketing', 'Operations', 'Legal',
    ];

    /** @var list<string> */
    private array $firstNames = [
        'Alex', 'Jordan', 'Sam', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Avery', 'Jamie',
        'Cameron', 'Drew', 'Harper', 'Reese', 'Skyler', 'Parker', 'Rowan', 'Elliot', 'Finley', 'Blake',
    ];

    /** @var list<string> */
    private array $lastNames = [
        'Rivera', 'Lee', 'Nguyen', 'Patel', 'Garcia', 'Kim', 'Brown', 'Silva', 'Novak', 'Cohen',
        'Anders', 'Berg', 'Costa', 'Dubois', 'Evans', 'Foster', 'Green', 'Hayes', 'Ibrahim', 'Jones',
    ];

    /** @var list<string> */
    private array $courseTopics = [
        'Phishing Basics', 'Password Hygiene', 'Safe Browsing', 'Mobile Security', 'Deepfake Awareness',
        'Business Email Compromise', 'Social Engineering', 'Data Classification', 'Remote Work Safety', 'USB Threats',
        'Ransomware Response', 'Privacy Essentials', 'Secure Messaging', 'AI Deception', 'Smishing and Vishing',
        'Cloud Sharing Risks', 'Credential Stuffing', 'Office Physical Security', 'Incident Reporting', 'Vendor Risk',
        'Multifactor Auth', 'Secure Travel', 'Insider Threats', 'Payment Fraud', 'Executive Impersonation',
    ];

    public function handle(): int
    {
        $tenant = Tenant::query()->find('company');
        if ($tenant === null) {
            $this->error('Tenant company was not found. Run the demo seeder first.');

            return self::FAILURE;
        }

        $targetCount = max(1, (int) $this->option('targets'));
        $chunk = max(50, (int) $this->option('chunk'));
        $fresh = (bool) $this->option('fresh');

        Tenancy::initialize($tenant);

        try {
            if ($fresh) {
                $this->info('Removing previous company report-seed rows…');
                $this->purgeMarked();
            }

            DB::table('organization_settings')->updateOrInsert(
                ['id' => 1],
                [
                    'display_name' => 'Company',
                    'primary_color' => '#083a6d',
                    'timezone' => 'UTC',
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );

            $this->info("Ensuring {$targetCount} employees and groups…");
            $targets = $this->ensureTargetsAndGroups($targetCount, $chunk);
            $this->info('Employees ready: '.$targets->count());

            $this->info('Ensuring courses and quizzes…');
            $courses = $this->ensureCoursesAndQuizzes();
            $quizCount = DB::table('quizzes')
                ->whereIn('course_id', $courses->pluck('id'))
                ->count();
            $this->info('Courses: '.$courses->count().' · Quizzes: '.$quizCount);

            $this->info('Seeding dated campaigns and assignment events…');
            $this->seedWaves($targets, $courses, $chunk);

            $assignments = DB::table('training_assignments')
                ->where('campaign_name', 'like', self::TITLE_PREFIX.'%')
                ->count();
            $events = DB::table('training_assignment_events')
                ->whereIn('training_assignment_id', function ($query): void {
                    $query->select('id')
                        ->from('training_assignments')
                        ->where('campaign_name', 'like', self::TITLE_PREFIX.'%');
                })
                ->count();

            $this->newLine();
            $this->info('Company report seed complete.');
            $this->line("targets={$targets->count()} quizzes={$quizCount} assignments={$assignments} events={$events}");
            $this->line('Generate PDFs for 2026-10 and 2026-Q3 from /org/reports/export.');
        } finally {
            Tenancy::end();
        }

        return self::SUCCESS;
    }

    private function purgeMarked(): void
    {
        $assignmentIds = DB::table('training_assignments')
            ->where(function ($query): void {
                $query->where('campaign_name', 'like', self::TITLE_PREFIX.'%')
                    ->orWhere('course_title', 'like', self::TITLE_PREFIX.'%')
                    ->orWhere('target_email', 'like', '%@'.self::EMAIL_DOMAIN);
            })
            ->pluck('id');

        if ($assignmentIds->isNotEmpty()) {
            DB::table('training_assignment_events')->whereIn('training_assignment_id', $assignmentIds)->delete();
            DB::table('training_assignments')->whereIn('id', $assignmentIds)->delete();
        }

        $campaignIds = DB::table('campaigns')
            ->where('name', 'like', self::TITLE_PREFIX.'%')
            ->pluck('id');
        if ($campaignIds->isNotEmpty()) {
            DB::table('campaign_recipients')->whereIn('campaign_id', $campaignIds)->delete();
            DB::table('campaigns')->whereIn('id', $campaignIds)->delete();
        }

        $courseIds = DB::table('courses')
            ->where('title', 'like', self::TITLE_PREFIX.'%')
            ->pluck('id');
        if ($courseIds->isNotEmpty()) {
            $quizIds = DB::table('quizzes')->whereIn('course_id', $courseIds)->pluck('id');
            if ($quizIds->isNotEmpty()) {
                DB::table('quiz_questions')->whereIn('quiz_id', $quizIds)->delete();
                DB::table('quizzes')->whereIn('id', $quizIds)->delete();
            }
            DB::table('lesson_progress')
                ->whereIn('enrollment_id', function ($query) use ($courseIds): void {
                    $query->select('id')->from('enrollments')->whereIn('course_id', $courseIds);
                })
                ->delete();
            DB::table('enrollments')->whereIn('course_id', $courseIds)->delete();
            DB::table('lessons')->whereIn('course_id', $courseIds)->delete();
            DB::table('courses')->whereIn('id', $courseIds)->delete();
        }

        $targetIds = DB::table('targets')
            ->where(function ($query): void {
                $query->where('email', 'like', '%@'.self::EMAIL_DOMAIN)
                    ->orWhere('external_id', 'like', self::EXTERNAL_PREFIX.'%');
            })
            ->pluck('id');
        if ($targetIds->isNotEmpty()) {
            DB::table('group_target')->whereIn('target_id', $targetIds)->delete();
            DB::table('targets')->whereIn('id', $targetIds)->delete();
        }

        $groupIds = DB::table('groups')
            ->where(function ($query): void {
                $query->where('source', self::GROUP_SOURCE)
                    ->orWhere('external_id', 'like', self::EXTERNAL_PREFIX.'group:%');
            })
            ->pluck('id');
        if ($groupIds->isNotEmpty()) {
            DB::table('group_target')->whereIn('group_id', $groupIds)->delete();
            DB::table('groups')->whereIn('id', $groupIds)->delete();
        }
    }

    /**
     * @return Collection<int, object{id:int,email:string,first_name:?string,last_name:?string,group_id:int,group_name:string}>
     */
    private function ensureTargetsAndGroups(int $count, int $chunk): Collection
    {
        $now = now()->toDateTimeString();
        $groupMap = [];
        foreach ($this->departments as $dept) {
            $ext = self::EXTERNAL_PREFIX.'group:'.$dept;
            $existing = DB::table('groups')->where('external_id', $ext)->first();
            if ($existing) {
                $groupMap[$dept] = ['id' => (int) $existing->id, 'name' => (string) $existing->name];

                continue;
            }
            $id = (int) DB::table('groups')->insertGetId([
                'name' => $dept,
                'status' => 'active',
                'source' => self::GROUP_SOURCE,
                'external_id' => $ext,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $groupMap[$dept] = ['id' => $id, 'name' => $dept];
        }

        $have = DB::table('targets')
            ->where('email', 'like', '%@'.self::EMAIL_DOMAIN)
            ->count();

        if ($have < $count) {
            $rows = [];
            $pivots = [];
            for ($n = $have + 1; $n <= $count; $n++) {
                $dept = $this->departments[($n - 1) % count($this->departments)];
                $email = sprintf('report.user.%03d@%s', $n, self::EMAIL_DOMAIN);
                $rows[] = [
                    'email' => $email,
                    'first_name' => $this->firstNames[($n - 1) % count($this->firstNames)],
                    'last_name' => $this->lastNames[($n + 3) % count($this->lastNames)],
                    'department' => $dept,
                    'status' => 'active',
                    'external_id' => self::EXTERNAL_PREFIX.'target:'.$n,
                    'risk_score' => ($n * 7) % 101,
                    'risk_tier' => 'unknown',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                if (count($rows) >= $chunk) {
                    DB::table('targets')->upsert($rows, ['email'], [
                        'first_name', 'last_name', 'department', 'status', 'external_id', 'risk_score', 'updated_at',
                    ]);
                    $rows = [];
                }
            }
            if ($rows !== []) {
                DB::table('targets')->upsert($rows, ['email'], [
                    'first_name', 'last_name', 'department', 'status', 'external_id', 'risk_score', 'updated_at',
                ]);
            }

            $targets = DB::table('targets')
                ->where('email', 'like', '%@'.self::EMAIL_DOMAIN)
                ->get(['id', 'email', 'department']);
            foreach ($targets as $target) {
                $dept = (string) $target->department;
                if (! isset($groupMap[$dept])) {
                    continue;
                }
                $pivots[] = [
                    'group_id' => $groupMap[$dept]['id'],
                    'target_id' => (int) $target->id,
                ];
                if (count($pivots) >= $chunk) {
                    DB::table('group_target')->upsert($pivots, ['group_id', 'target_id']);
                    $pivots = [];
                }
            }
            if ($pivots !== []) {
                DB::table('group_target')->upsert($pivots, ['group_id', 'target_id']);
            }
        }

        return DB::table('targets as t')
            ->join('group_target as gt', 'gt.target_id', '=', 't.id')
            ->join('groups as g', 'g.id', '=', 'gt.group_id')
            ->where('t.email', 'like', '%@'.self::EMAIL_DOMAIN)
            ->where('g.source', self::GROUP_SOURCE)
            ->orderBy('t.id')
            ->get([
                't.id',
                't.email',
                't.first_name',
                't.last_name',
                'g.id as group_id',
                'g.name as group_name',
            ]);
    }

    /**
     * @return Collection<int, object{id:int,title:string}>
     */
    private function ensureCoursesAndQuizzes(): Collection
    {
        $now = now()->toDateTimeString();
        foreach ($this->courseTopics as $index => $topic) {
            $title = self::TITLE_PREFIX.' '.$topic;
            $courseId = DB::table('courses')->where('title', $title)->value('id');
            if (! $courseId) {
                $courseId = DB::table('courses')->insertGetId([
                    'title' => $title,
                    'description' => 'Seeded awareness module for business reports.',
                    'duration_minutes' => 8,
                    'is_sample' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $lessonExists = DB::table('lessons')->where('course_id', $courseId)->exists();
            if (! $lessonExists) {
                DB::table('lessons')->insert([
                    'course_id' => $courseId,
                    'title' => 'Lesson 1',
                    'content_type' => 'text',
                    'body' => 'Review the key risks for '.$topic.'.',
                    'sort_order' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            for ($q = 1; $q <= 4; $q++) {
                $quizTitle = self::TITLE_PREFIX." {$topic} Quiz {$q}";
                $quizId = DB::table('quizzes')->where('course_id', $courseId)->where('title', $quizTitle)->value('id');
                if ($quizId) {
                    continue;
                }
                $quizId = DB::table('quizzes')->insertGetId([
                    'course_id' => $courseId,
                    'title' => $quizTitle,
                    'pass_score' => 70,
                    'is_required' => true,
                    'sort_order' => $q,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                DB::table('quiz_questions')->insert([
                    [
                        'quiz_id' => $quizId,
                        'type' => 'mcq',
                        'prompt' => "Which action best reduces risk for {$topic}?",
                        'options' => json_encode(['Verify the sender', 'Click every link', 'Share passwords'], JSON_THROW_ON_ERROR),
                        'correct_index' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                    [
                        'quiz_id' => $quizId,
                        'type' => 'mcq',
                        'prompt' => "What is a warning sign related to {$topic}?",
                        'options' => json_encode(['Unexpected urgency', 'Expected newsletter', 'Known calendar invite'], JSON_THROW_ON_ERROR),
                        'correct_index' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ]);
            }
            unset($index);
        }

        return DB::table('courses')
            ->where('title', 'like', self::TITLE_PREFIX.'%')
            ->orderBy('id')
            ->get(['id', 'title']);
    }

    /**
     * @param  Collection<int, object>  $targets
     * @param  Collection<int, object{id:int,title:string}>  $courses
     */
    private function seedWaves(Collection $targets, Collection $courses, int $chunk): void
    {
        $courseList = $courses->values();
        $waves = [
            ['month' => '2026-04', 'day' => 8, 'courseIndexes' => [0, 1, 2], 'size' => 180, 'mix' => [0.40, 0.15, 0.05, 0.40], 'remedial' => false],
            ['month' => '2026-05', 'day' => 12, 'courseIndexes' => [3, 4, 5], 'size' => 200, 'mix' => [0.35, 0.20, 0.05, 0.40], 'remedial' => false],
            ['month' => '2026-06', 'day' => 10, 'courseIndexes' => [6, 7, 8], 'size' => 220, 'mix' => [0.30, 0.20, 0.05, 0.45], 'remedial' => false],
            ['month' => '2026-07', 'day' => 7, 'courseIndexes' => [9, 10, 11, 12], 'size' => 400, 'mix' => [0.55, 0.15, 0.05, 0.25], 'remedial' => false],
            ['month' => '2026-08', 'day' => 11, 'courseIndexes' => [13, 14, 15], 'size' => 380, 'mix' => [0.50, 0.18, 0.04, 0.28], 'remedial' => false],
            ['month' => '2026-09', 'day' => 9, 'courseIndexes' => [16, 17, 18], 'size' => 360, 'mix' => [0.48, 0.17, 0.05, 0.30], 'remedial' => false],
            ['month' => '2026-09', 'day' => 20, 'courseIndexes' => [19], 'size' => 120, 'mix' => [0.40, 0.20, 0.10, 0.30], 'remedial' => true],
            ['month' => '2026-10', 'day' => 6, 'courseIndexes' => [20, 21, 22], 'size' => 450, 'mix' => [0.52, 0.16, 0.04, 0.28], 'remedial' => false],
            ['month' => '2026-10', 'day' => 18, 'courseIndexes' => [23], 'size' => 140, 'mix' => [0.45, 0.20, 0.10, 0.25], 'remedial' => true],
            ['month' => '2026-11', 'day' => 5, 'courseIndexes' => [24, 0, 1], 'size' => 300, 'mix' => [0.42, 0.18, 0.05, 0.35], 'remedial' => false],
        ];

        foreach ($waves as $wave) {
            $audience = $targets->take((int) $wave['size'])->values();
            if ($audience->isEmpty()) {
                continue;
            }
            foreach ($wave['courseIndexes'] as $courseIndex) {
                $course = $courseList->get($courseIndex);
                if ($course === null) {
                    continue;
                }
                $this->seedCampaignWave(
                    $course,
                    $audience,
                    (string) $wave['month'],
                    (int) $wave['day'],
                    (bool) $wave['remedial'],
                    $wave['mix'],
                    $chunk,
                );
            }
        }
    }

    /**
     * @param  object{id:int,title:string}  $course
     * @param  Collection<int, object>  $audience
     * @param  array{0:float,1:float,2:float,3:float}  $mix  no_action, incomplete, failed, passed
     */
    private function seedCampaignWave(
        object $course,
        Collection $audience,
        string $month,
        int $day,
        bool $remedial,
        array $mix,
        int $chunk,
    ): void {
        $label = $remedial ? 'Remedial' : 'Wave';
        $campaignName = self::TITLE_PREFIX." {$label} {$month} · {$course->title}";
        if (DB::table('campaigns')->where('name', $campaignName)->exists()) {
            return;
        }

        $startsAt = sprintf('%s-%02d 10:00:00', $month, $day);
        $now = now()->toDateTimeString();
        $campaignId = (int) DB::table('campaigns')->insertGetId([
            'name' => $campaignName,
            'type' => 'training',
            'status' => 'completed',
            'is_remedial' => $remedial,
            'course_id' => (int) $course->id,
            'starts_at' => $startsAt,
            'ends_at' => sprintf('%s-%02d 18:00:00', $month, min(28, $day + 10)),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $enrollmentRows = [];
        foreach ($audience as $target) {
            $enrollmentRows[] = [
                'course_id' => (int) $course->id,
                'target_id' => (int) $target->id,
                'status' => 'assigned',
                'progress' => 0,
                'completed_at' => null,
                'source' => 'campaign',
                'opened_at' => null,
                'created_at' => $startsAt,
                'updated_at' => $startsAt,
            ];
            if (count($enrollmentRows) >= $chunk) {
                DB::table('enrollments')->upsert($enrollmentRows, ['course_id', 'target_id'], ['updated_at']);
                $enrollmentRows = [];
            }
        }
        if ($enrollmentRows !== []) {
            DB::table('enrollments')->upsert($enrollmentRows, ['course_id', 'target_id'], ['updated_at']);
        }

        $enrollments = DB::table('enrollments')
            ->where('course_id', (int) $course->id)
            ->whereIn('target_id', $audience->pluck('id'))
            ->pluck('id', 'target_id');

        $recipientRows = [];
        $assignmentRows = [];
        $recipientKeys = [];
        foreach ($audience as $target) {
            $token = Str::random(40);
            $recipientRows[] = [
                'campaign_id' => $campaignId,
                'target_id' => (int) $target->id,
                'tracking_token' => $token,
                'status' => 'sent',
                'sent_at' => $startsAt,
                'created_at' => $startsAt,
                'updated_at' => $startsAt,
            ];
            $recipientKeys[] = (int) $target->id;
            if (count($recipientRows) >= $chunk) {
                DB::table('campaign_recipients')->insert($recipientRows);
                $recipientRows = [];
            }
        }
        if ($recipientRows !== []) {
            DB::table('campaign_recipients')->insert($recipientRows);
        }

        $recipients = DB::table('campaign_recipients')
            ->where('campaign_id', $campaignId)
            ->whereIn('target_id', $recipientKeys)
            ->pluck('id', 'target_id');

        foreach ($audience as $index => $target) {
            $name = trim(((string) $target->first_name).' '.((string) $target->last_name));
            if ($name === '') {
                $name = (string) $target->email;
            }
            $assignmentRows[] = [
                'campaign_id' => $campaignId,
                'campaign_name' => $campaignName,
                'course_id' => (int) $course->id,
                'course_title' => (string) $course->title,
                'target_id' => (int) $target->id,
                'target_name' => $name,
                'target_email' => (string) $target->email,
                'group_id' => (int) $target->group_id,
                'group_name' => (string) $target->group_name,
                'enrollment_id' => (int) ($enrollments[(int) $target->id] ?? 0) ?: null,
                'recipient_id' => (int) ($recipients[(int) $target->id] ?? 0) ?: null,
                'is_remedial' => $remedial,
                'status' => 'no_action',
                'sent_at' => $startsAt,
                'created_at' => $startsAt,
                'updated_at' => $startsAt,
            ];
            if (count($assignmentRows) >= $chunk) {
                DB::table('training_assignments')->insert($assignmentRows);
                $assignmentRows = [];
            }
            unset($index);
        }
        if ($assignmentRows !== []) {
            DB::table('training_assignments')->insert($assignmentRows);
        }

        $assignments = DB::table('training_assignments')
            ->where('campaign_id', $campaignId)
            ->orderBy('id')
            ->get(['id']);

        $eventRows = [];
        $total = max(1, $assignments->count());
        $noActionEnd = (int) floor($total * $mix[0]);
        $incompleteEnd = $noActionEnd + (int) floor($total * $mix[1]);
        $failedEnd = $incompleteEnd + (int) floor($total * $mix[2]);

        foreach ($assignments as $i => $assignment) {
            $sentAt = sprintf('%s-%02d %02d:%02d:00', $month, $day, 10 + ($i % 6), $i % 60);
            $eventRows[] = [
                'training_assignment_id' => (int) $assignment->id,
                'type' => 'sent',
                'occurred_at' => $sentAt,
                'created_at' => $sentAt,
            ];

            if ($i < $noActionEnd) {
                $status = 'no_action';
            } elseif ($i < $incompleteEnd) {
                $status = 'incomplete';
                $startedAt = sprintf('%s-%02d %02d:%02d:00', $month, min(28, $day + 1), 11 + ($i % 5), ($i * 3) % 60);
                $eventRows[] = [
                    'training_assignment_id' => (int) $assignment->id,
                    'type' => 'started',
                    'occurred_at' => $startedAt,
                    'created_at' => $startedAt,
                ];
            } elseif ($i < $failedEnd) {
                $status = 'failed';
                $startedAt = sprintf('%s-%02d %02d:%02d:00', $month, min(28, $day + 1), 12, ($i * 2) % 60);
                $failedAt = sprintf('%s-%02d %02d:%02d:00', $month, min(28, $day + 2), 14, ($i * 5) % 60);
                $eventRows[] = [
                    'training_assignment_id' => (int) $assignment->id,
                    'type' => 'started',
                    'occurred_at' => $startedAt,
                    'created_at' => $startedAt,
                ];
                $eventRows[] = [
                    'training_assignment_id' => (int) $assignment->id,
                    'type' => 'failed',
                    'occurred_at' => $failedAt,
                    'created_at' => $failedAt,
                ];
            } else {
                $status = 'passed';
                $startedAt = sprintf('%s-%02d %02d:%02d:00', $month, min(28, $day + 1), 13, ($i * 4) % 60);
                $passedAt = sprintf('%s-%02d %02d:%02d:00', $month, min(28, $day + 3), 15, ($i * 7) % 60);
                $eventRows[] = [
                    'training_assignment_id' => (int) $assignment->id,
                    'type' => 'started',
                    'occurred_at' => $startedAt,
                    'created_at' => $startedAt,
                ];
                $eventRows[] = [
                    'training_assignment_id' => (int) $assignment->id,
                    'type' => 'passed',
                    'occurred_at' => $passedAt,
                    'created_at' => $passedAt,
                ];
            }

            DB::table('training_assignments')->where('id', $assignment->id)->update(['status' => $status]);

            if (count($eventRows) >= $chunk) {
                DB::table('training_assignment_events')->insert($eventRows);
                $eventRows = [];
            }
        }
        if ($eventRows !== []) {
            DB::table('training_assignment_events')->insert($eventRows);
        }
    }
}
