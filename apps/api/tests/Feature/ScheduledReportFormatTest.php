<?php

use App\Domains\AnalyticsReporting\Actions\DispatchDueReportSchedules;
use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
    Storage::fake('local');
    Mail::fake();
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
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
