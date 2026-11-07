<?php

use App\Domains\AnalyticsReporting\Actions\DispatchDueReportSchedules;
use App\Domains\Ticketing\Jobs\PollTicketingEmailReadersJob;
use App\Domains\Ticketing\Jobs\ProcessTicketEscalationsJob;
use App\Domains\Ticketing\Jobs\SendDelayedTicketNotificationsJob;
use App\Models\Tenant;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Stancl\Tenancy\Facades\Tenancy;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('hrneck:dispatch-report-schedules', function (DispatchDueReportSchedules $dispatcher) {
    $total = 0;
    foreach (Tenant::query()->cursor() as $tenant) {
        Tenancy::initialize($tenant);
        $total += $dispatcher->handle();
        Tenancy::end();
    }
    $this->info("Dispatched {$total} scheduled report(s).");
})->purpose('Send due tenant report schedules via SMTP');

Schedule::command('hrneck:dispatch-report-schedules')->hourly();
Schedule::command('hrneck:prune-report-archives')->daily();
Schedule::command('hrneck:prune-activity-logs')->daily();
Schedule::job(new ProcessTicketEscalationsJob)->everyMinute();
Schedule::job(new SendDelayedTicketNotificationsJob)->everyMinute();
Schedule::job(new PollTicketingEmailReadersJob)->everyMinute();
