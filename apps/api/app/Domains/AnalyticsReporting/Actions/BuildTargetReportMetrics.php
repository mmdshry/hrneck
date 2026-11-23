<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class BuildTargetReportMetrics
{
    private const LIST_CAP = 500;

    public function __construct(
        private readonly ResolveBusinessReportPeriod $periods,
        private readonly ClassifyTrainingAssignmentOutcome $classifier,
    ) {}

    /**
     * @param  array{
     *   mode: string,
     *   target_id?: int|null,
     *   group_id?: int|null,
     *   target_ids?: list<int>,
     *   include_training?: bool
     * }  $options
     * @return array<string, mixed>
     */
    public function handle(string $periodKey, string $timezone = 'UTC', array $options = []): array
    {
        $mode = $options['mode'] ?? 'single';
        if (! in_array($mode, ['single', 'list'], true)) {
            throw new InvalidArgumentException("Unsupported employee report mode [{$mode}].");
        }

        $includeTraining = (bool) ($options['include_training'] ?? true);
        $period = $this->periods->parse($periodKey, $timezone);
        $organization = $this->organizationName();

        $targetId = isset($options['target_id']) ? (int) $options['target_id'] : null;
        $groupId = isset($options['group_id']) ? (int) $options['group_id'] : null;
        /** @var list<int> $targetIds */
        $targetIds = array_values(array_unique(array_map(
            static fn ($id): int => (int) $id,
            $options['target_ids'] ?? [],
        )));

        if ($mode === 'single') {
            if ($targetId === null || $targetId <= 0) {
                throw new InvalidArgumentException('A target_id is required for single employee reports.');
            }
            $targetIds = [$targetId];
        }

        $assignments = $includeTraining
            ? $this->loadAssignments($period['start'], $period['end'], $targetIds, $groupId)
            : collect();

        $classified = $this->classifier->classify(
            $assignments,
            $period['start'],
            $period['end'],
            $period['timezone'],
        );
        $summary = $this->classifier->summarize($classified);

        $filters = [
            'mode' => $mode,
            'target_id' => $mode === 'single' ? $targetId : null,
            'group_id' => $groupId,
            'target_ids' => $mode === 'list' ? $targetIds : [],
        ];

        $base = [
            'title' => $mode === 'single' ? 'Employee Training Report' : 'Employee Training Roster',
            'mode' => $mode,
            'period_type' => $period['type'],
            'period_key' => $period['key'],
            'period_label' => $period['label'],
            'timezone' => $period['timezone'],
            'brand' => (string) config('brand.name'),
            'organization' => $organization,
            'generated_at' => now('UTC')->format('m/d/Y H:i').' UTC',
            'filters' => $filters,
            'summary' => $summary,
            'status_order' => ClassifyTrainingAssignmentOutcome::STATUS_ORDER,
            'status_labels' => ClassifyTrainingAssignmentOutcome::STATUS_LABELS,
            'employee' => null,
            'assignments' => [],
            'employees' => [],
            'truncated' => false,
            'contents' => $mode === 'single'
                ? [
                    ['number' => '01', 'title' => 'Employee'],
                    ['number' => '02', 'title' => 'Summary'],
                    ['number' => '03', 'title' => 'Assignments'],
                ]
                : [
                    ['number' => '01', 'title' => 'Summary'],
                    ['number' => '02', 'title' => 'Employees'],
                ],
        ];

        if ($mode === 'single') {
            $target = Target::query()->findOrFail($targetId);
            $base['employee'] = $this->employeeProfile($target, $classified);
            $base['assignments'] = $this->assignmentRows($classified);

            return $base;
        }

        $roster = $this->employeeRows($classified);
        $truncated = count($roster) > self::LIST_CAP;
        $base['employees'] = array_slice($roster, 0, self::LIST_CAP);
        $base['truncated'] = $truncated;

        return $base;
    }

    /**
     * @param  list<int>  $targetIds
     * @return Collection<int, TrainingAssignment>
     */
    private function loadAssignments(Carbon $from, Carbon $to, array $targetIds, ?int $groupId): Collection
    {
        $start = $from->copy()->utc();
        $end = $to->copy()->utc();

        $query = TrainingAssignment::query()
            ->with(['events' => function ($events) use ($start, $end): void {
                $events->whereBetween('occurred_at', [$start, $end]);
            }])
            ->whereHas('events', function ($events) use ($start, $end): void {
                $events->whereBetween('occurred_at', [$start, $end]);
            });

        if ($targetIds !== []) {
            $query->whereIn('target_id', $targetIds);
        }

        if ($groupId !== null && $groupId > 0) {
            $query->where('group_id', $groupId);
        }

        return $query->get();
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return array<string, mixed>
     */
    private function employeeProfile(Target $target, Collection $rows): array
    {
        $name = trim(implode(' ', array_filter([(string) $target->first_name, (string) $target->last_name])));
        if ($name === '') {
            $first = $rows->first();
            $name = $first !== null
                ? (string) $first['assignment']->target_name
                : (string) $target->email;
        }

        $group = $rows
            ->map(fn (array $row): string => trim((string) $row['assignment']->group_name))
            ->filter()
            ->first() ?? '';

        $remedialCount = $rows->filter(fn (array $row): bool => (bool) $row['assignment']->is_remedial)->count();

        return [
            'id' => $target->id,
            'name' => $name,
            'email' => (string) $target->email,
            'department' => (string) ($target->department ?? ''),
            'job_title' => (string) ($target->job_title ?? ''),
            'group' => $group,
            'employee_number' => (string) ($target->employee_number ?? ''),
            'remedial_count' => $remedialCount,
        ];
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return list<array<string, mixed>>
     */
    private function assignmentRows(Collection $rows): array
    {
        $items = $rows->map(function (array $row): array {
            return [
                'campaign' => (string) $row['assignment']->campaign_name,
                'course' => (string) $row['assignment']->course_title,
                'group' => (string) $row['assignment']->group_name,
                'status' => $row['status'],
                'status_label' => ClassifyTrainingAssignmentOutcome::STATUS_LABELS[$row['status']],
                'is_remedial' => (bool) $row['assignment']->is_remedial,
                'date' => $row['at']->format('m/d/Y'),
                'sort_at' => $row['at']->getTimestamp(),
            ];
        })->all();

        usort($items, function (array $left, array $right): int {
            $byDate = $left['sort_at'] <=> $right['sort_at'];
            if ($byDate !== 0) {
                return $byDate;
            }

            return strcmp($left['course'], $right['course']);
        });

        foreach ($items as $index => $item) {
            unset($items[$index]['sort_at']);
        }

        return array_values($items);
    }

    /**
     * @param  Collection<int, array{assignment: TrainingAssignment, status: string, at: Carbon}>  $rows
     * @return list<array<string, mixed>>
     */
    private function employeeRows(Collection $rows): array
    {
        $grouped = $rows->groupBy(function (array $row): string {
            $id = $row['assignment']->target_id;
            if ($id !== null) {
                return 'id:'.$id;
            }

            $email = strtolower(trim((string) $row['assignment']->target_email));

            return $email !== '' ? 'email:'.$email : 'name:'.$row['assignment']->target_name;
        });

        $employees = [];
        foreach ($grouped as $group) {
            $first = $group->first();
            if ($first === null) {
                continue;
            }
            $summary = $this->classifier->summarize($group);
            $employees[] = [
                'name' => (string) $first['assignment']->target_name,
                'email' => (string) $first['assignment']->target_email,
                'group' => (string) $first['assignment']->group_name,
                'assigned' => $summary['assigned'],
                'no_action' => $summary['counts']['no_action'],
                'incomplete' => $summary['counts']['incomplete'],
                'failed' => $summary['counts']['failed'],
                'passed' => $summary['counts']['passed'],
                'completion_rate' => $this->classifier->pct($summary['counts']['passed'], $summary['assigned']),
                'remedial_count' => $group->filter(fn (array $row): bool => (bool) $row['assignment']->is_remedial)->count(),
            ];
        }

        usort($employees, function (array $left, array $right): int {
            return strcmp(strtolower($left['email']), strtolower($right['email']));
        });

        return $employees;
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
