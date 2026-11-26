<?php

namespace App\Domains\AnalyticsReporting\Jobs;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\AnalyticsReporting\Actions\BuildOrgDetailedReport;
use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\AnalyticsReporting\Actions\ResolveBusinessReportPeriod;
use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Models\User;
use App\Support\AppLocale;
use App\Support\OrgTimezone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Stancl\Tenancy\Facades\Tenancy;

class SendScheduledReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $email,
        public string $format = 'csv',
        public string $cadence = 'monthly',
        public ?string $tenantId = null,
        public string $section = ReportSchedule::SUMMARY_SECTION,
    ) {}

    public function handle(
        BuildCampaignReport $report,
        BuildOrgDetailedReport $detailed,
        BuildQuarterlyPdfReport $pdf,
        ResolveBusinessReportPeriod $periods,
    ): void {
        $ownsTenancy = false;
        if ($this->tenantId !== null && $this->tenantId !== '' && tenant() === null) {
            Tenancy::initialize($this->tenantId);
            $ownsTenancy = true;
        }

        try {
            $recipient = User::query()
                ->withEmail($this->email)
                ->when(
                    is_string($this->tenantId) && $this->tenantId !== '',
                    fn ($query) => $query->where('tenant_id', $this->tenantId),
                )
                ->first(['locale']);
            if ($recipient !== null) {
                App::setLocale(AppLocale::normalize(is_string($recipient->locale) ? $recipient->locale : null));
            }

            match ($this->format) {
                'pdf' => $this->sendPdf($pdf, $periods),
                'csv' => $this->sendCsv($report, $detailed, $periods),
                default => throw new \InvalidArgumentException("Unsupported report format [{$this->format}]."),
            };
        } finally {
            if ($ownsTenancy) {
                Tenancy::end();
            }
        }
    }

    private function sendCsv(
        BuildCampaignReport $report,
        BuildOrgDetailedReport $detailed,
        ResolveBusinessReportPeriod $periods,
    ): void {
        if ($this->section === ReportSchedule::SUMMARY_SECTION) {
            $data = $report->handle();
            $csv = "metric,value\n".collect($data)->map(fn ($v, $k) => "{$k},{$v}")->implode("\n");

            Mail::to($this->email)->send(new CampaignReportMail($csv));

            return;
        }

        $timezone = OrgTimezone::current();
        $filters = $this->sectionFilters($periods, $timezone);
        $sectionLabel = Str::headline($this->section);

        Mail::to($this->email)->send(new CampaignReportMail(
            '',
            csvAttachment: $detailed->csvContent($this->section, $filters),
            csvAttachmentName: 'org-report-'.$this->section.'-'.now($timezone)->format('Ymd-His').'.csv',
            subjectLine: __('notifications.campaign_report_section_subject', [
                'brand' => config('brand.short'),
                'section' => $sectionLabel,
            ]),
            truncated: $detailed->csvTruncated($this->section, $filters),
        ));
    }

    /**
     * Period the scheduled CSV covers. Monthly and quarterly match the PDF period, weekly covers the
     * last seven full days, and one-off sends cover all data.
     *
     * @return array{from?: Carbon, to?: Carbon}
     */
    private function sectionFilters(ResolveBusinessReportPeriod $periods, string $timezone): array
    {
        if ($this->cadence === 'weekly') {
            return [
                'from' => now($timezone)->subDays(7)->startOfDay()->utc(),
                'to' => now($timezone)->subDay()->endOfDay()->utc(),
            ];
        }

        if ($this->cadence === 'monthly' || $this->cadence === 'quarterly') {
            $closed = $periods->closed($this->cadence, $timezone);
            $parsed = $periods->parse($closed['key'], $timezone);

            return [
                'from' => $parsed['start']->copy()->utc(),
                'to' => $parsed['end']->copy()->utc(),
            ];
        }

        return [];
    }

    private function sendPdf(BuildQuarterlyPdfReport $pdf, ResolveBusinessReportPeriod $periods): void
    {
        $timezone = OrgTimezone::current();
        $closed = $periods->closed($this->cadence, $timezone);
        $built = $pdf->handle($closed['key'], 'business', [
            'timezone' => $timezone,
            'include_training' => true,
            'period_type' => $closed['type'],
        ]);
        $binary = Storage::disk('local')->get($built['path']);

        if (! is_string($binary) || $binary === '') {
            throw new \RuntimeException('Scheduled PDF report was empty.');
        }

        $label = $closed['type'] === 'quarterly' ? 'Quarterly' : 'Monthly';
        Mail::to($this->email)->send(new CampaignReportMail(
            '',
            $binary,
            basename($built['path']),
            config('brand.short').' '.$label.' Business Report '.$closed['key'],
        ));
    }
}
