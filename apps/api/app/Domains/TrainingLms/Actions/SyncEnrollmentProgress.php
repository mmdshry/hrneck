<?php

namespace App\Domains\TrainingLms\Actions;

use App\Domains\Campaigns\Actions\MaybeCompleteTrainingCampaign;
use App\Domains\Campaigns\Actions\RecordTrainingAssignmentEvent;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Campaigns\Models\TrainingAssignmentEvent;
use App\Domains\TargetsGroups\Actions\RecalculateTargetRisk;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\LessonProgress;
use App\Domains\TrainingLms\Models\QuizAttempt;

class SyncEnrollmentProgress
{
    public function __construct(
        private readonly RecordTrainingAssignmentEvent $assignmentEvents,
    ) {}

    public function markOpened(Enrollment $enrollment, ?int $assignmentId = null): void
    {
        if ($enrollment->opened_at === null) {
            $enrollment->forceFill(['opened_at' => now()])->save();
        }

        if ($enrollment->status === 'assigned') {
            $enrollment->forceFill(['status' => 'in_progress'])->save();
        }

        $this->mirrorCampaignRecipients($enrollment, opened: true, completed: false);
        $this->assignmentEvents->appendForEnrollment(
            $enrollment,
            TrainingAssignmentEvent::STARTED,
            $assignmentId,
        );
    }

    public function recompute(Enrollment $enrollment, ?int $assignmentId = null): Enrollment
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
        $allAttempted = true;
        foreach ($requiredQuizzes as $quiz) {
            $attempts = QuizAttempt::query()
                ->where('quiz_id', $quiz->id)
                ->where('target_id', $enrollment->target_id)
                ->get(['passed']);

            if ($attempts->isEmpty()) {
                $allAttempted = false;
                $requiredQuizzesPassed = false;

                continue;
            }

            $passed = $attempts->contains(fn ($attempt): bool => (bool) $attempt->passed);
            if (! $passed) {
                $requiredQuizzesPassed = false;
            }
        }

        $allLessonsDone = $completedLessons >= $lessonIds->count();
        $completed = $allLessonsDone && $requiredQuizzesPassed;
        $failedCourse = $allLessonsDone
            && $requiredQuizzes->isNotEmpty()
            && $allAttempted
            && ! $requiredQuizzesPassed;

        $enrollment->forceFill([
            'progress' => $completed ? 100 : $lessonPct,
            'status' => $completed ? 'completed' : ($enrollment->opened_at || $completedLessons > 0 ? 'in_progress' : $enrollment->status),
            'completed_at' => $completed ? ($enrollment->completed_at ?? now()) : null,
            'opened_at' => $enrollment->opened_at ?? ($completedLessons > 0 ? now() : $enrollment->opened_at),
        ])->save();

        $this->mirrorCampaignRecipients($enrollment, opened: $enrollment->opened_at !== null, completed: $completed);
        $this->recordAssignmentOutcome($enrollment, $assignmentId, $completed, $failedCourse, $completedLessons);

        if ($completed) {
            $target = Target::query()->find($enrollment->target_id);
            if ($target !== null) {
                $target->forceFill([
                    'last_training_completed_at' => $enrollment->completed_at ?? now(),
                ])->save();

                app(RecalculateTargetRisk::class)->handle($target);
            }
        }

        return $enrollment->fresh(['course', 'target', 'lessonProgress']) ?? $enrollment;
    }

    private function recordAssignmentOutcome(
        Enrollment $enrollment,
        ?int $assignmentId,
        bool $completed,
        bool $failedCourse,
        int $completedLessons,
    ): void {
        if ($completed) {
            $this->assignmentEvents->appendForEnrollment($enrollment, TrainingAssignmentEvent::PASSED, $assignmentId);

            return;
        }

        if ($failedCourse) {
            $this->assignmentEvents->appendForEnrollment($enrollment, TrainingAssignmentEvent::FAILED, $assignmentId);

            return;
        }

        if ($enrollment->opened_at !== null || $completedLessons > 0) {
            $this->assignmentEvents->appendForEnrollment($enrollment, TrainingAssignmentEvent::STARTED, $assignmentId);
        }
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

        $touchedCampaignIds = [];

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
                $touchedCampaignIds[] = (int) $recipient->campaign_id;
            }
        }

        if ($completed && $touchedCampaignIds !== []) {
            $completer = app(MaybeCompleteTrainingCampaign::class);
            foreach (array_unique($touchedCampaignIds) as $campaignId) {
                $completer->handle($campaignId);
            }
        }
    }
}
