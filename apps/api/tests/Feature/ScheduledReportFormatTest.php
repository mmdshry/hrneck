<?php

use App\Domains\AnalyticsReporting\Actions\DispatchDueReportSchedules;
use App\Domains\AnalyticsReporting\Jobs\SendScheduledReportJob;
use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

beforeEach(function () {
    Mail::fake();
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    Storage::fake('local');
});

/**
 * Creates a schedule addressed to one organization member.
 *
 * @param  array<string, mixed>  $attributes
 */
function scheduleAddressedTo(User $recipient, array $attributes): ReportSchedule
{
    $schedule = ReportSchedule::query()->create($attributes);
    $schedule->syncRecipientUserIds([$recipient->id]);

    return $schedule;
}

test('a monthly pdf schedule sends a pdf attachment', function () {
    scheduleAddressedTo(orgAdmin(), [
        'name' => 'Monthly PDF',
        'cadence' => 'monthly',
        'format' => 'pdf',
        'next_run_at' => now()->subMinute(),
    ]);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, function (CampaignReportMail $mail): bool {
        return str_starts_with((string) $mail->pdfBinary, '%PDF');
    });
});

test('a monthly schedule attaches the previous closed month', function () {
    Carbon::setTestNow('2026-11-23 12:00:00');

    scheduleAddressedTo(orgAdmin(), [
        'name' => 'Monthly PDF',
        'cadence' => 'monthly',
        'format' => 'pdf',
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

    scheduleAddressedTo(orgAdmin(), [
        'name' => 'Quarterly PDF',
        'cadence' => 'quarterly',
        'format' => 'pdf',
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
    scheduleAddressedTo(orgAdmin(), [
        'name' => 'Weekly CSV',
        'cadence' => 'weekly',
        'format' => 'csv',
        'next_run_at' => now()->subMinute(),
    ]);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, function (CampaignReportMail $mail): bool {
        return $mail->pdfBinary === null && str_contains($mail->csvBody, 'metric,value');
    });
});

test('a schedule for a detailed section attaches that section as a csv file', function () {
    scheduleAddressedTo(orgAdmin(), [
        'name' => 'Targets CSV',
        'cadence' => 'monthly',
        'format' => 'csv',
        'section' => 'targets',
        'next_run_at' => now()->subMinute(),
    ]);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, function (CampaignReportMail $mail): bool {
        return $mail->csvBody === ''
            && $mail->pdfBinary === null
            && str_starts_with((string) $mail->csvAttachmentName, 'org-report-targets-')
            && str_contains((string) $mail->csvAttachment, 'email');
    });
});

test('the api stores the chosen schedule section and defaults to the summary', function () {
    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Users monthly',
            'cadence' => 'monthly',
            'format' => 'csv',
            'section' => 'users',
            'recipient_user_ids' => [$admin->id],
        ])
        ->assertCreated()
        ->assertJsonPath('data.section', 'users');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Summary default',
            'cadence' => 'monthly',
            'format' => 'csv',
            'recipient_user_ids' => [$admin->id],
        ])
        ->assertCreated()
        ->assertJsonPath('data.section', 'summary');
});

test('the api rejects an unknown schedule section', function () {
    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Bogus section',
            'cadence' => 'monthly',
            'format' => 'csv',
            'section' => 'not-a-section',
            'recipient_user_ids' => [orgAdmin()->id],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['section']);
});

test('the api refuses a weekly pdf schedule', function () {
    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Weekly PDF',
            'cadence' => 'weekly',
            'format' => 'pdf',
            'recipient_user_ids' => [orgAdmin()->id],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['cadence']);
});

test('a one-off section email queues that section to a member', function () {
    Queue::fake();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/email', [
            'recipient_user_ids' => [orgAdmin()->id],
            'section' => 'training',
        ])
        ->assertOk()
        ->assertJson(['queued' => true]);

    Queue::assertPushed(SendScheduledReportJob::class, function (SendScheduledReportJob $job): bool {
        return $job->email === 'admin@itneck.test'
            && $job->section === 'training'
            && $job->cadence === ReportSchedule::ON_DEMAND_CADENCE;
    });
});

test('a one-off section email rejects an unknown section', function () {
    Queue::fake();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/email', [
            'recipient_user_ids' => [orgAdmin()->id],
            'section' => 'not-a-section',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['section']);

    Queue::assertNotPushed(SendScheduledReportJob::class);
});
