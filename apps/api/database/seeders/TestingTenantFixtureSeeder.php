<?php

namespace Database\Seeders;

use App\Domains\MailDelivery\Models\SendingProfile;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Lightweight tenant fixture for test resets.
 *
 * Omits ProvisionEmployeePair (central user provisioning) which dominates
 * TenantSampleSeeder cost, while keeping targets/groups/course/checklist/ticketing.
 */
class TestingTenantFixtureSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedSampleAudienceWithoutUsers();

        SendingProfile::query()->firstOrCreate(
            ['from_email' => config('mail.from.address', 'noreply@hrneck.com')],
            [
                'name' => 'Default SMTP',
                'from_name' => config('mail.from.name', config('brand.short')),
                'mailer' => 'smtp',
                'is_default' => true,
            ],
        );

        $course = Course::query()->firstOrCreate(
            ['title' => 'Security fundamentals'],
            [
                'description' => 'Recognize common social-engineering patterns.',
                'duration_minutes' => 8,
                'is_sample' => true,
            ],
        );

        Lesson::query()->firstOrCreate(
            ['course_id' => $course->id, 'sort_order' => 1],
            [
                'title' => 'Spot the lure',
                'content_type' => 'text',
                'body' => 'Look for urgency, unexpected attachments, and mismatched domains.',
            ],
        );

        $quiz = Quiz::query()->firstOrCreate(
            ['course_id' => $course->id],
            [
                'title' => 'Retention check',
                'pass_score' => 70,
                'is_required' => true,
                'sort_order' => 0,
            ],
        );

        QuizQuestion::query()->firstOrCreate(
            ['quiz_id' => $quiz->id, 'prompt' => 'Which is a social-engineering red flag?'],
            [
                'type' => 'mcq',
                'options' => ['Urgent payment request from unknown sender', 'Newsletter you subscribed to', 'Calendar invite from your manager'],
                'correct_index' => 0,
            ],
        );

        DB::table('organization_settings')->updateOrInsert(
            ['id' => 1],
            [
                'display_name' => tenant('id') ? strtoupper((string) tenant('id')) : 'Organization',
                'primary_color' => '#083a6d',
                'timezone' => 'UTC',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $this->call(ChecklistHrTemplatesSeeder::class);
        $this->call(ChecklistWelcomePackSeeder::class);
        $this->call(TicketingItilSeeder::class);
    }

    private function seedSampleAudienceWithoutUsers(): void
    {
        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : 'central';

        $users = [
            [
                'external_id' => 'u-1001',
                'email' => 'alex.rivera@example.test',
                'first_name' => 'Alex',
                'last_name' => 'Rivera',
            ],
            [
                'external_id' => 'u-1002',
                'email' => 'jordan.lee@example.test',
                'first_name' => 'Jordan',
                'last_name' => 'Lee',
            ],
            [
                'external_id' => 'u-1003',
                'email' => 'sam.patel@example.test',
                'first_name' => 'Sam',
                'last_name' => 'Patel',
            ],
        ];

        $targetMap = [];
        foreach ($users as $user) {
            [$local, $domain] = array_pad(explode('@', (string) $user['email'], 2), 2, 'example.test');
            $email = $local.'+'.$tenantId.'@'.$domain;

            $target = Target::query()->updateOrCreate(
                ['external_id' => $user['external_id']],
                [
                    'email' => $email,
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'status' => 'active',
                ],
            );
            $targetMap[$user['external_id']] = $target->id;
        }

        $groups = [
            [
                'external_id' => 'g-finance',
                'name' => 'Finance',
                'member_external_ids' => ['u-1001', 'u-1003'],
            ],
            [
                'external_id' => 'g-engineering',
                'name' => 'Engineering',
                'member_external_ids' => ['u-1002'],
            ],
        ];

        foreach ($groups as $groupData) {
            $group = Group::query()->updateOrCreate(
                ['external_id' => $groupData['external_id']],
                [
                    'name' => $groupData['name'],
                    'source' => 'manual',
                    'status' => 'active',
                ],
            );
            $memberIds = collect($groupData['member_external_ids'])
                ->map(fn (string $id) => $targetMap[$id] ?? null)
                ->filter()
                ->values()
                ->all();
            $group->targets()->sync($memberIds);
        }
    }
}
