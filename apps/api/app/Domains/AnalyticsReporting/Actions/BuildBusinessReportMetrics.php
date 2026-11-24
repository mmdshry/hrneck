<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\Campaigns\Models\TrainingAssignmentEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BuildBusinessReportMetrics
{
    private const RISK_USER_LIMIT = 100;

    private const COURSE_CAP = 150;

    public function __construct(
        private readonly ResolveBusinessReportPeriod $periods,
        private readonly ClassifyTrainingAssignmentOutcome $classifier,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(string $periodKey, string $timezone = 'UTC', bool $includeTraining = true): array
    {
        $period = $this->periods->parse($periodKey, $timezone);
        $organization = $this->organizationName();
        $assignments = $includeTraining
            ? $this->loadAssignments($period['previous_start'], $period['end'])
            : collect();

        $trainingRows = $assignments->filter(fn (TrainingAssignment $row): bool => ! $row->is_remedial)->values();
        $remedialRows = $assignments->filter(fn (TrainingAssignment $row): bool => $row->is_remedial)->values();

        $current = $this->classifier->classify($trainingRows, $period['start'], $period['end'], $period['timezone']);
        $previous = $this->classifier->classify($trainingRows, $period['previous_start'], $period['previous_end'], $period['timezone']);
        $remedial = $this->classifier->classify($remedialRows, $period['start'], $period['end'], $period['timezone']);

        $currentSummary = $this->classifier->summarize($current);
        $previousSummary = $this->classifier->summarize($previous);
        $statuses = [];
        foreach (ClassifyTrainingAssignmentOutcome::STATUS_ORDER as $key) {
            $currentMonths = [];
            foreach ($period['current_months'] as $month) {
                $monthSummary = $this->classifier->summarize($this->classifier->classify(
                    $trainingRows,
                    $month['start'],
                    $month['end'],
                    $period['timezone'],
                ));
                $currentMonths[] = $monthSummary['percents'][$key];
            }
            $previousMonths = [];
            foreach ($period['previous_months'] as $month) {
                $monthSummary = $this->classifier->summarize($this->classifier->classify(
                    $trainingRows,
                    $month['start'],
                    $month['end'],
                    $period['timezone'],
                ));
                $previousMonths[] = $monthSummary['percents'][$key];
            }
            $delta = $currentSummary['percents'][$key] - $previousSummary['percents'][$key];
            $statuses[$key] = [
                'key' => $key,
                'label' => ClassifyTrainingAssignmentOutcome::STATUS_LABELS[$key],
                'current' => $currentSummary['percents'][$key],
                'previous' => $previousSummary['percents'][$key],
                'delta' => $delta,
                'delta_label' => ($delta < 0 ? '' : '+').$delta.'%',
                'current_months' => $currentMonths,
                'previous_months' => $previousMonths,
            ];
        }

        $actions = $current->count();
        $riskMode = $actions > self::RISK_USER_LIMIT ? 'courses' : 'users';
        $courseRollup = $this->courseRows($current);
        $riskTitle = $riskMode === 'courses' ? 'Training Courses by Risk Level' : 'Users by Risk Level';

        return [
            'title' => $period['type'] === 'quarterly' ? 'Quarterly Business Report' : 'Monthly Business Report',
            'period_type' => $period['type'],
            'period_key' => $period['key'],
            'period_label' => $period['label'],
            'timezone' => $period['timezone'],
            'brand' => (string) config('brand.name'),
            'organization' => $organization,
            'generated_at' => now('UTC')->format('m/d/Y H:i').' UTC',
            'contents' => [
                ['number' => '01', 'title' => 'Summary'],
                ['number' => '02', 'title' => 'Training & Awareness Details'],
                ['number' => '03', 'title' => $riskTitle],
                ['number' => '04', 'title' => 'Remedial Training Details'],
            ],
            'training' => [
                'campaigns' => $this->distinctCampaigns($current),
                'assigned' => $currentSummary['assigned'],
                'current_month_labels' => array_column($period['current_months'], 'label'),
                'previous_month_labels' => array_column($period['previous_months'], 'label'),
                'status_order' => ClassifyTrainingAssignmentOutcome::STATUS_ORDER,
                'statuses' => $statuses,
                'details' => [
                    'emails_sent' => $this->emailsSent($current, $period['start'], $period['end'], $period['timezone']),
                    'courses' => $current->map(fn (array $row): string => (string) $row['assignment']->course_title)->unique()->count(),
                    'counts' => $currentSummary['counts'],
                    'percents' => $currentSummary['percents'],
                    'rows' => $this->detailRows($current),
                ],
                'risk' => [
                    'mode' => $riskMode,
                    'title' => $riskTitle,
                    'action_count' => $actions,
                    'truncated' => $riskMode === 'courses' && $courseRollup['truncated'],
                    'users' => $riskMode === 'users' ? $this->userRows($current) : [],
                    'courses' => $riskMode === 'courses' ? $courseRollup['rows'] : [],
                ],
            ],
            'remedial' => $this->remedialBlock($remedial),
        ];
    }

    /**
     * @return Collection<int, TrainingAssignment>
     */
    private function loadAssignments(Carbon $from, Carbon $to): Collection
    {
        $start = $from->copy()->utc();
        $end = $to->copy()->utc();

        return TrainingAssignment::query()
            ->with(['events' => function ($query) use ($start, $end): void {
                $query->whereBetween('occurred_at', [$start, $end]);
            }])
            ->whereHas('events', function ($query) use ($start, $end): void {
                $query->whereBetween('occurred_at', [$start, $end]);
            })
            ->get();
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     */
    private function distinctCampaigns(Collection $rows): int
    {
        return $rows->map(function (array $row): string {
            $id = $row['assignment']->campaign_id;

            return $id !== null ? 'id:'.$id : 'name:'.$row['assignment']->campaign_name;
        })->unique()->count();
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     */
    private function emailsSent(Collection $rows, Carbon $start, Carbon $end, string $timezone): int
    {
        return $rows->filter(function (array $row) use ($start, $end, $timezone): bool {
            foreach ($row['assignment']->events as $event) {
                if ($event->type !== TrainingAssignmentEvent::SENT) {
                    continue;
                }
                $at = $event->occurred_at->copy()->timezone($timezone);
                if ($at->gte($start) && $at->lte($end)) {
                    return true;
                }
            }

            return false;
        })->count();
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return list<array<string, mixed>>
     */
    private function detailRows(Collection $rows): array
    {
        $grouped = $rows->groupBy(function (array $row): string {
            $assignment = $row['assignment'];
            $campaign = $assignment->campaign_id !== null
                ? 'id:'.$assignment->campaign_id
                : 'name:'.$assignment->campaign_name;

            return $campaign.'|'.$assignment->course_title.'|'.$assignment->group_name;
        });

        $table = [];
        foreach ($grouped as $group) {
            $first = $group->first();
            if ($first === null) {
                continue;
            }
            $summary = $this->classifier->summarize($group);
            $assignment = $first['assignment'];
            $table[] = [
                'campaign' => $assignment->campaign_name,
                'course' => $assignment->course_title,
                'group' => $assignment->group_name,
                'assigned' => $summary['assigned'],
                'no_action' => $summary['counts']['no_action'],
                'no_action_pct' => $summary['percents']['no_action'],
                'incomplete' => $summary['counts']['incomplete'],
                'incomplete_pct' => $summary['percents']['incomplete'],
                'failed' => $summary['counts']['failed'],
                'failed_pct' => $summary['percents']['failed'],
                'passed' => $summary['counts']['passed'],
                'passed_pct' => $summary['percents']['passed'],
            ];
        }

        usort($table, function (array $left, array $right): int {
            return [$left['campaign'], $left['course'], $left['group']]
                <=> [$right['campaign'], $right['course'], $right['group']];
        });

        return $table;
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return list<array<string, mixed>>
     */
    private function userRows(Collection $rows): array
    {
        $order = ['no_action' => 0, 'incomplete' => 1, 'failed' => 2];
        $items = [];

        foreach ($rows as $row) {
            if (! isset($order[$row['status']])) {
                continue;
            }
            $items[] = [
                'status' => $row['status'],
                'status_label' => ClassifyTrainingAssignmentOutcome::STATUS_LABELS[$row['status']],
                'name' => $row['assignment']->target_name,
                'course' => $row['assignment']->course_title,
                'group' => $row['assignment']->group_name,
                'email' => $row['assignment']->target_email,
                'at' => $row['at'],
            ];
        }

        usort($items, function (array $left, array $right) use ($order): int {
            $byStatus = $order[$left['status']] <=> $order[$right['status']];
            if ($byStatus !== 0) {
                return $byStatus;
            }
            $byDate = $left['at']->getTimestamp() <=> $right['at']->getTimestamp();
            if ($byDate !== 0) {
                return $byDate;
            }

            return strcmp((string) $left['name'], (string) $right['name']);
        });

        foreach ($items as $index => $item) {
            $items[$index]['date'] = $item['at']->format('m/d/Y');
            unset($items[$index]['at']);
        }

        return $items;
    }

    /**
     * Completion rate is passed divided by users targeted, matching the sample PDFs.
     *
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return array{truncated: bool, rows: list<array<string, mixed>>}
     */
    private function courseRows(Collection $rows): array
    {
        $grouped = $rows->groupBy(fn (array $row): string => (string) $row['assignment']->course_title);
        $courses = [];

        foreach ($grouped as $title => $group) {
            $summary = $this->classifier->summarize($group);
            $courses[] = [
                'course' => (string) $title,
                'groups_targeted' => $group->map(fn (array $row): string => (string) $row['assignment']->group_name)->unique()->count(),
                'users_targeted' => $summary['assigned'],
                'incomplete_or_no_action' => $summary['counts']['no_action'] + $summary['counts']['incomplete'],
                'failed' => $summary['counts']['failed'],
                'completion_rate' => $this->classifier->pct($summary['counts']['passed'], $summary['assigned']),
            ];
        }

        usort($courses, function (array $left, array $right): int {
            $byRate = $left['completion_rate'] <=> $right['completion_rate'];

            return $byRate !== 0 ? $byRate : strcmp($left['course'], $right['course']);
        });

        $truncated = count($courses) > self::COURSE_CAP;

        return [
            'truncated' => $truncated,
            'rows' => array_slice($courses, 0, self::COURSE_CAP),
        ];
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return array<string, mixed>
     */
    private function remedialBlock(Collection $rows): array
    {
        $summary = $this->classifier->summarize($rows);
        $grouped = $rows->groupBy(function (array $row): string {
            return $row['assignment']->course_title.'|'.$row['assignment']->campaign_name;
        });

        $table = [];
        foreach ($grouped as $group) {
            $first = $group->first();
            if ($first === null) {
                continue;
            }
            $rowSummary = $this->classifier->summarize($group);
            $table[] = [
                'course' => $first['assignment']->course_title,
                'campaign' => $first['assignment']->campaign_name,
                'enrollments' => $rowSummary['assigned'],
                'no_action' => $rowSummary['counts']['no_action'],
                'no_action_pct' => $rowSummary['percents']['no_action'],
                'incomplete' => $rowSummary['counts']['incomplete'],
                'incomplete_pct' => $rowSummary['percents']['incomplete'],
                'failed' => $rowSummary['counts']['failed'],
                'failed_pct' => $rowSummary['percents']['failed'],
                'passed' => $rowSummary['counts']['passed'],
                'passed_pct' => $rowSummary['percents']['passed'],
            ];
        }

        usort($table, function (array $left, array $right): int {
            return [$left['course'], $left['campaign']] <=> [$right['course'], $right['campaign']];
        });

        $people = $rows->map(function (array $row): string {
            $email = strtolower(trim((string) $row['assignment']->target_email));

            return $email !== '' ? $email : 'id:'.(string) $row['assignment']->target_id;
        })->unique()->count();

        return [
            'empty' => $rows->isEmpty(),
            'high_risk_users' => $people,
            'counts' => $summary['counts'],
            'percents' => $summary['percents'],
            'rows' => $table,
        ];
    }

    private function organizationName(): string
    {
        $name = DB::table('organization_settings')->value('display_name');
        if (is_string($name) && trim($name) !== '') {
            return trim($name);
        }

        $tenant = tenant('id');

        return is_string($tenant) && $tenant !== '' ? $tenant : (string) config('brand.name');
    }
}
