<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\Campaigns\Models\TrainingAssignmentEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class ClassifyTrainingAssignmentOutcome
{
    /** @var array<string, string> */
    public const STATUS_LABELS = [
        'no_action' => 'No Action Taken',
        'incomplete' => 'Incomplete',
        'failed' => 'Failed',
        'passed' => 'Passed',
    ];

    /** @var list<string> */
    public const STATUS_ORDER = ['no_action', 'incomplete', 'failed', 'passed'];

    /**
     * @param  Collection<int, TrainingAssignment>  $assignments
     * @return Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>
     */
    public function classify(Collection $assignments, Carbon $start, Carbon $end, string $timezone): Collection
    {
        return $assignments->map(function (TrainingAssignment $assignment) use ($start, $end, $timezone): ?array {
            $found = $this->outcome($assignment, $start, $end, $timezone);
            if ($found === null) {
                return null;
            }

            return [
                'assignment' => $assignment,
                'status' => $found['status'],
                'at' => $found['at'],
            ];
        })->filter()->values();
    }

    /**
     * @return array{status: string, at: Carbon}|null
     */
    public function outcome(TrainingAssignment $assignment, Carbon $start, Carbon $end, string $timezone): ?array
    {
        $bestType = null;
        $bestAt = null;
        $bestRank = -1;

        foreach ($assignment->events as $event) {
            $rank = TrainingAssignmentEvent::RANK[$event->type] ?? null;
            if ($rank === null || $event->occurred_at === null) {
                continue;
            }

            $at = $event->occurred_at->copy()->timezone($timezone);
            if ($at->lt($start) || $at->gt($end)) {
                continue;
            }

            if ($bestAt === null || $at->gt($bestAt) || ($at->equalTo($bestAt) && $rank >= $bestRank)) {
                $bestType = $event->type;
                $bestAt = $at;
                $bestRank = $rank;
            }
        }

        if ($bestType === null || $bestAt === null) {
            return null;
        }

        $status = match ($bestType) {
            TrainingAssignmentEvent::PASSED => 'passed',
            TrainingAssignmentEvent::FAILED => 'failed',
            TrainingAssignmentEvent::STARTED => 'incomplete',
            TrainingAssignmentEvent::SENT => 'no_action',
            default => throw new InvalidArgumentException("Unknown training event [{$bestType}]."),
        };

        return ['status' => $status, 'at' => $bestAt];
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return array{assigned: int, counts: array<string, int>, percents: array<string, int>}
     */
    public function summarize(Collection $rows): array
    {
        $counts = [
            'no_action' => 0,
            'incomplete' => 0,
            'failed' => 0,
            'passed' => 0,
        ];

        foreach ($rows as $row) {
            if (isset($counts[$row['status']])) {
                $counts[$row['status']]++;
            }
        }

        $assigned = $rows->count();
        $percents = [];
        foreach ($counts as $key => $count) {
            $percents[$key] = $this->pct($count, $assigned);
        }

        return [
            'assigned' => $assigned,
            'counts' => $counts,
            'percents' => $percents,
        ];
    }

    public function pct(int $count, int $total): int
    {
        if ($total <= 0) {
            return 0;
        }

        return (int) round(($count / $total) * 100);
    }
}
