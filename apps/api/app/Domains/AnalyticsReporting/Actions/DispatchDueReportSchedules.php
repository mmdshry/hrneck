<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\AnalyticsReporting\Jobs\SendScheduledReportJob;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;

class DispatchDueReportSchedules
{
    public function handle(): int
    {
        $due = ReportSchedule::query()
            ->where(function ($q): void {
                $q->whereNull('next_run_at')->orWhere('next_run_at', '<=', now());
            })
            ->get();

        foreach ($due as $schedule) {
            SendScheduledReportJob::dispatch(
                $schedule->recipient_email,
                (string) $schedule->format,
            );
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
}
