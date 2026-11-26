<?php

namespace App\Domains\TrainingLms\Actions;

use App\Domains\TrainingLms\Models\Enrollment;
use App\Domains\TrainingLms\Models\TrainingAttestation;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecordTrainingAttestation
{
    public function __construct(
        private readonly SyncEnrollmentProgress $sync,
    ) {}

    /**
     * Stores the learner's acceptance once per enrollment, then recomputes so the
     * enrollment can complete. Repeat calls do not write another audit row.
     *
     * @throws ValidationException when the lessons or required quizzes are not finished
     */
    public function handle(Enrollment $enrollment, ?string $ipAddress, ?string $userAgent, ?int $assignmentId = null): Enrollment
    {
        $current = $this->sync->recompute(
            $enrollment->fresh(['course.lessons', 'course.quizzes', 'target']) ?? $enrollment,
            $assignmentId,
        );

        if ($current->attested_at === null && ! $current->attestation_pending) {
            throw ValidationException::withMessages([
                'attestation' => ['Complete all lessons and required quizzes before accepting the course attestation.'],
            ]);
        }

        DB::transaction(function () use ($enrollment, $ipAddress, $userAgent): void {
            $locked = Enrollment::query()->whereKey($enrollment->id)->lockForUpdate()->firstOrFail();
            if ($locked->attested_at !== null) {
                return;
            }

            TrainingAttestation::query()->create([
                'enrollment_id' => $locked->id,
                'course_id' => $locked->course_id,
                'target_id' => $locked->target_id,
                'text_version' => TrainingAttestation::TEXT_VERSION,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent !== null ? mb_substr($userAgent, 0, 512) : null,
                'accepted_at' => now(),
            ]);

            $locked->forceFill(['attested_at' => now()])->save();
        });

        return $this->sync->recompute(
            $enrollment->fresh(['course.lessons', 'course.quizzes', 'target']) ?? $enrollment,
            $assignmentId,
        );
    }
}
