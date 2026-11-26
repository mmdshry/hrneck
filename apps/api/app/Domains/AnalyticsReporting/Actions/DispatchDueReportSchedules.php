<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\AnalyticsReporting\Jobs\SendScheduledReportJob;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use Illuminate\Support\Facades\Log;

class DispatchDueReportSchedules
{
    public function __construct(private ResolveReportRecipients $resolveRecipients) {}

    public function handle(): int
    {
        $due = ReportSchedule::query()
            ->where(function ($q): void {
                $q->whereNull('next_run_at')->orWhere('next_run_at', '<=', now());
            })
            ->get();

        $tenantId = tenant('id');
        $tenantId = $tenantId === null ? null : (string) $tenantId;

        foreach ($due as $schedule) {
            foreach ($this->deliverableEmails($schedule, $tenantId) as $email) {
                SendScheduledReportJob::dispatch(
                    $email,
                    (string) $schedule->format,
                    (string) $schedule->cadence,
                    $tenantId,
                    (string) $schedule->section,
                );
            }

            $schedule->forceFill([
                'last_run_at' => now(),
                'next_run_at' => match ($schedule->cadence) {
                    'weekly' => now()->addWeek(),
                    'quarterly' => now()->addMonths(3),
                    default => now()->addMonth(),
                },
            ])->save();
        }

        return $due->count();
    }

    /**
     * Addresses of the schedule's recipients who are still active and still have report access.
     *
     * @return list<string>
     */
    private function deliverableEmails(ReportSchedule $schedule, ?string $tenantId): array
    {
        $recipientIds = $schedule->recipientUserIds();
        if ($tenantId === null || $recipientIds === []) {
            return [];
        }

        $deliverable = $this->resolveRecipients->handle($tenantId, $recipientIds);

        $deliverableIds = $deliverable->pluck('id')->map(fn ($id): int => (int) $id)->all();
        $skipped = array_values(array_diff($recipientIds, $deliverableIds));
        if ($skipped !== []) {
            Log::warning('Scheduled report recipients skipped: inactive or without report access.', [
                'report_schedule_id' => $schedule->id,
                'user_ids' => $skipped,
            ]);
        }

        return $deliverable
            ->pluck('email')
            ->map(fn ($email): string => (string) $email)
            ->values()
            ->all();
    }
}
