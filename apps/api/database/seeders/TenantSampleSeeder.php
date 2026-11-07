<?php

namespace Database\Seeders;

use App\Domains\DirectorySync\Actions\RunDirectorySync;
use App\Domains\MailDelivery\Models\SendingProfile;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Lesson;
use App\Domains\TrainingLms\Models\Quiz;
use App\Domains\TrainingLms\Models\QuizQuestion;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TenantSampleSeeder extends Seeder
{
    public function run(): void
    {
        app(RunDirectorySync::class)->handle();

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
            ['title' => 'Retention check', 'pass_score' => 70],
        );

        QuizQuestion::query()->firstOrCreate(
            ['quiz_id' => $quiz->id, 'prompt' => 'Which is a social-engineering red flag?'],
            [
                'options' => ['Urgent payment request from unknown sender', 'Newsletter you subscribed to', 'Calendar invite from your manager'],
                'correct_index' => 0,
            ],
        );

        DB::table('organization_settings')->updateOrInsert(
            ['id' => 1],
            [
                'display_name' => tenant('id') ? strtoupper((string) tenant('id')) : 'Organization',
                'primary_color' => '#0f766e',
                'timezone' => 'UTC',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $this->call(ChecklistHrTemplatesSeeder::class);
        $this->call(TicketingItilSeeder::class);
    }
}
