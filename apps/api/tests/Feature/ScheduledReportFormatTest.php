<?php

use App\Domains\AnalyticsReporting\Actions\DispatchDueReportSchedules;
use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Models\Tenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

beforeEach(function () {
    Mail::fake();
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    Storage::fake('local');
});

test('a pdf schedule sends a pdf attachment', function () {
    ReportSchedule::query()->create([
        'name' => 'Weekly PDF',
        'cadence' => 'weekly',
        'format' => 'pdf',
        'recipient_email' => 'reports@itneck.test',
        'next_run_at' => now()->subMinute(),
    ]);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, function (CampaignReportMail $mail): bool {
        return str_starts_with((string) $mail->pdfBinary, '%PDF');
    });
});

test('a monthly schedule attaches the previous closed month', function () {
    Carbon::setTestNow('2026-11-23 12:00:00');

    ReportSchedule::query()->create([
        'name' => 'Monthly PDF',
        'cadence' => 'monthly',
        'format' => 'pdf',
        'recipient_email' => 'reports@itneck.test',
        'next_run_at' => now()->subMinute(),
    ]);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, function (CampaignReportMail $mail): bool {
        return $mail->pdfName === '2026-10-business.pdf'
            && str_starts_with((string) $mail->pdfBinary, '%PDF')
            && str_contains((string) $mail->subjectLine, 'Monthly Business Report 2026-10');
    });

    Carbon::setTestNow();
});

test('a quarterly schedule attaches the previous closed quarter', function () {
    Carbon::setTestNow('2026-11-23 12:00:00');

    ReportSchedule::query()->create([
        'name' => 'Quarterly PDF',
        'cadence' => 'quarterly',
        'format' => 'pdf',
        'recipient_email' => 'reports@itneck.test',
        'next_run_at' => now()->subMinute(),
    ]);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, function (CampaignReportMail $mail): bool {
        return $mail->pdfName === '2026-Q3-business.pdf'
            && str_starts_with((string) $mail->pdfBinary, '%PDF')
            && str_contains((string) $mail->subjectLine, 'Quarterly Business Report 2026-Q3');
    });

    Carbon::setTestNow();
});

test('a csv schedule does not attach a pdf', function () {
    ReportSchedule::query()->create([
        'name' => 'Weekly CSV',
        'cadence' => 'weekly',
        'format' => 'csv',
        'recipient_email' => 'reports@itneck.test',
        'next_run_at' => now()->subMinute(),
    ]);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, function (CampaignReportMail $mail): bool {
        return $mail->pdfBinary === null && str_contains($mail->csvBody, 'metric,value');
    });
});
