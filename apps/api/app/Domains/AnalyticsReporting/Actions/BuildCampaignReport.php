<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Enrollment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class BuildCampaignReport
{
    /**
     * Training-campaign funnel: open / complete / no-action (aligned with CampaignController::dashboard).
     *
     * @return array{
     *   campaigns: int,
     *   campaigns_running: int,
     *   recipients: int,
     *   opened: int,
     *   completed: int,
     *   no_action: int,
     *   opened_pct: float,
     *   completed_pct: float,
     *   no_action_pct: float,
     *   enrollments: int,
     *   active_employees: int
     * }
     */
    public function handle(
        ?int $campaignId = null,
        ?int $departmentId = null,
        ?Carbon $from = null,
        ?Carbon $to = null,
    ): array {
        $campaignQuery = Campaign::query()->where('type', 'training');
        if ($campaignId) {
            $campaignQuery->whereKey($campaignId);
        }
        if ($from || $to) {
            $campaignQuery->where(function (Builder $q) use ($from, $to): void {
                $q->whereHas('recipients', function (Builder $recipients) use ($from, $to): void {
                    if ($from) {
                        $recipients->where('sent_at', '>=', $from);
                    }
                    if ($to) {
                        $recipients->where('sent_at', '<=', $to);
                    }
                })->orWhere(function (Builder $fallback) use ($from, $to): void {
                    $fallback->whereDoesntHave('recipients', fn (Builder $r) => $r->whereNotNull('sent_at'));
                    if ($from) {
                        $fallback->where('starts_at', '>=', $from);
                    }
                    if ($to) {
                        $fallback->where('starts_at', '<=', $to);
                    }
                });
            });
        }

        $campaigns = $campaignQuery->with(['recipients' => function ($q) use ($departmentId, $from, $to): void {
            if ($departmentId) {
                $q->whereHas('target', fn (Builder $t) => $t->where('department_id', $departmentId));
            }
            if ($from) {
                $q->where(function (Builder $inner) use ($from): void {
                    $inner->where('sent_at', '>=', $from)->orWhereNull('sent_at');
                });
            }
            if ($to) {
                $q->where(function (Builder $inner) use ($to): void {
                    $inner->where('sent_at', '<=', $to)->orWhereNull('sent_at');
                });
            }
        }])->get();

        /** @var Collection<int, CampaignRecipient> $recipients */
        $recipients = $campaigns->flatMap->recipients;
        $recipientTotal = $recipients->count();

        $courseIds = $campaigns->pluck('course_id')->filter()->unique()->values();
        $enrollmentQuery = Enrollment::query()->whereIn('course_id', $courseIds);
        if ($departmentId) {
            $enrollmentQuery->whereHas('target', fn (Builder $t) => $t->where('department_id', $departmentId));
        }
        if ($from) {
            $enrollmentQuery->where('created_at', '>=', $from);
        }
        if ($to) {
            $enrollmentQuery->where('created_at', '<=', $to);
        }
        $enrollments = $courseIds->isEmpty() ? collect() : $enrollmentQuery->get();

        $openedFromEnrollment = $enrollments->whereNotNull('opened_at')->count();
        $completedFromEnrollment = $enrollments->where('status', 'completed')->count();
        $openedRecipients = $recipients->filter(
            fn ($r) => $r->opened_at !== null || $r->status === 'completed' || $r->status === 'opened'
        )->count();
        $completedRecipients = $recipients->where('status', 'completed')->count();

        $openedCount = max($openedFromEnrollment, $openedRecipients);
        $completedCount = max($completedFromEnrollment, $completedRecipients);
        $metricTotal = max($enrollments->count(), $recipientTotal, 1);
        $noAction = max(0, $metricTotal - $openedCount);

        $employeesQuery = Target::query()->where('status', 'active');
        if ($departmentId) {
            $employeesQuery->where('department_id', $departmentId);
        }

        return [
            'campaigns' => $campaigns->count(),
            'campaigns_running' => $campaigns->where('status', 'running')->count(),
            'recipients' => $recipientTotal,
            'opened' => $openedCount,
            'completed' => $completedCount,
            'no_action' => $noAction,
            'opened_pct' => round(($openedCount / $metricTotal) * 100, 1),
            'completed_pct' => round(($completedCount / $metricTotal) * 100, 1),
            'no_action_pct' => round(($noAction / $metricTotal) * 100, 1),
            'enrollments' => $enrollments->count(),
            'active_employees' => $employeesQuery->count(),
        ];
    }
}
