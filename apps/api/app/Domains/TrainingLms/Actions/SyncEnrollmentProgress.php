<?php

namespace App\Domains\TrainingLms\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Domains\TrainingLms\Models\QuizAttempt;

class SyncEnrollmentProgress
{
    public function markOpened(Enrollment $enrollment): void
    {
        if ($enrollment->opened_at === null) {
            $enrollment->forceFill(['opened_at' => now()])->save();
        }

        if ($enrollment->status === 'assigned') {
            $enrollment->forceFill(['status' => 'in_progress'])->save();
        }

        $this->mirrorCampaignRecipients($enrollment, opened: true, completed: false);
    }

    public function recompute(Enrollment $enrollment): Enrollment
    {
        $enrollment->loadMissing(['course.lessons', 'course.quizzes']);

        $lessonIds = $enrollment->course?->lessons->pluck('id') ?? collect();
        $totalLessons = max(1, $lessonIds->count());
        $completedLessons = LessonProgress::query()
            ->where('enrollment_id', $enrollment->id)
            ->whereIn('lesson_id', $lessonIds)
            ->where('status', 'completed')
            ->count();

        $lessonPct = (int) round(($completedLessons / $totalLessons) * 100);

        $requiredQuizzes = $enrollment->course?->quizzes
            ->where('is_required', true)
            ->values() ?? collect();

        $requiredQuizzesPassed = true;
        foreach ($requiredQuizzes as $quiz) {
            $passed = QuizAttempt::query()
                ->where('quiz_id', $quiz->id)
                ->where('target_id', $enrollment->target_id)
                ->where('passed', true)
                ->exists();
            if (! $passed) {
                $requiredQuizzesPassed = false;
                break;
            }
        }

        $allLessonsDone = $completedLessons >= $lessonIds->count();
        $completed = $allLessonsDone && $requiredQuizzesPassed;

        $enrollment->forceFill([
            'progress' => $completed ? 100 : $lessonPct,
            'status' => $completed ? 'completed' : ($enrollment->opened_at || $completedLessons > 0 ? 'in_progress' : $enrollment->status),
            'completed_at' => $completed ? ($enrollment->completed_at ?? now()) : null,
            'opened_at' => $enrollment->opened_at ?? ($completedLessons > 0 ? now() : $enrollment->opened_at),
        ])->save();

        $this->mirrorCampaignRecipients($enrollment, opened: $enrollment->opened_at !== null, completed: $completed);

        return $enrollment->fresh(['course', 'target', 'lessonProgress']) ?? $enrollment;
    }

    private function mirrorCampaignRecipients(Enrollment $enrollment, bool $opened, bool $completed): void
    {
        $campaignIds = Campaign::query()
            ->where('type', 'training')
            ->where('course_id', $enrollment->course_id)
            ->pluck('id');

        if ($campaignIds->isEmpty()) {
            return;
        }

        $recipients = CampaignRecipient::query()
            ->whereIn('campaign_id', $campaignIds)
            ->where('target_id', $enrollment->target_id)
            ->get();

        foreach ($recipients as $recipient) {
            $updates = [];
            if ($opened && $recipient->opened_at === null) {
                $updates['opened_at'] = now();
                if ($recipient->status === 'sent' || $recipient->status === 'pending') {
                    $updates['status'] = 'opened';
                }
            }
            if ($completed) {
                $updates['status'] = 'completed';
                $updates['opened_at'] = $recipient->opened_at ?? now();
            }
            if ($updates !== []) {
                $recipient->forceFill($updates)->save();
            }
        }
    }
}
