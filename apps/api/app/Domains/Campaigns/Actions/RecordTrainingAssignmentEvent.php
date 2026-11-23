<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\Campaigns\Models\TrainingAssignmentEvent;
use App\Domains\TrainingLms\Models\Enrollment;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

class RecordTrainingAssignmentEvent
{
    public function append(TrainingAssignment $assignment, string $type, ?Carbon $at = null): void
    {
        if (! in_array($type, TrainingAssignmentEvent::TYPES, true)) {
            throw new InvalidArgumentException("Unknown training assignment event [{$type}].");
        }

        if ($assignment->events()->where('type', $type)->exists()) {
            return;
        }

        if (
            in_array($type, [TrainingAssignmentEvent::STARTED, TrainingAssignmentEvent::FAILED], true)
            && $assignment->events()->where('type', TrainingAssignmentEvent::PASSED)->exists()
        ) {
            return;
        }

        $assignment->events()->create([
            'type' => $type,
            'occurred_at' => $at ?? now(),
        ]);

        $this->refreshStatus($assignment);
    }

    public function appendForEnrollment(Enrollment $enrollment, string $type, ?int $assignmentId = null): void
    {
        $assignment = $this->resolve($enrollment, $assignmentId);
        if ($assignment === null) {
            return;
        }

        $this->append($assignment, $type);
    }

    public function resolve(Enrollment $enrollment, ?int $assignmentId): ?TrainingAssignment
    {
        if ($assignmentId !== null && $assignmentId > 0) {
            $chosen = TrainingAssignment::query()->find($assignmentId);
            if (
                $chosen !== null
                && (int) $chosen->course_id === (int) $enrollment->course_id
                && (int) $chosen->target_id === (int) $enrollment->target_id
            ) {
                return $chosen;
            }
        }

        return TrainingAssignment::query()
            ->where('course_id', $enrollment->course_id)
            ->where('target_id', $enrollment->target_id)
            ->whereDoesntHave('events', fn ($query) => $query->where('type', TrainingAssignmentEvent::PASSED))
            ->orderByDesc('id')
            ->first();
    }

    private function refreshStatus(TrainingAssignment $assignment): void
    {
        $assignment->unsetRelation('events');
        $assignment->load('events');

        $best = null;
        $bestAt = null;
        $bestRank = -1;

        foreach ($assignment->events as $event) {
            $rank = TrainingAssignmentEvent::RANK[$event->type] ?? 0;
            $at = $event->occurred_at;
            if ($best === null || $at->gt($bestAt) || ($at->equalTo($bestAt) && $rank >= $bestRank)) {
                $best = $event;
                $bestAt = $at;
                $bestRank = $rank;
            }
        }

        $status = match ($best?->type) {
            TrainingAssignmentEvent::PASSED => 'passed',
            TrainingAssignmentEvent::FAILED => 'failed',
            TrainingAssignmentEvent::STARTED => 'incomplete',
            default => 'no_action',
        };

        $sent = $assignment->events->firstWhere('type', TrainingAssignmentEvent::SENT);

        $assignment->forceFill([
            'status' => $status,
            'sent_at' => $sent?->occurred_at ?? $assignment->sent_at,
        ])->save();
    }
}
