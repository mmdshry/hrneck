<?php

namespace App\Domains\AnalyticsReporting\Jobs;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\AnalyticsReporting\Actions\ResolveBusinessReportPeriod;
use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Models\User;
use App\Support\AppLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

class SendScheduledReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $email,
        public string $format = 'csv',
        public string $cadence = 'monthly',
        public ?string $tenantId = null,
    ) {}

    public function handle(
        BuildCampaignReport $report,
        BuildQuarterlyPdfReport $pdf,
        ResolveBusinessReportPeriod $periods,
    ): void {
        $ownsTenancy = false;
        if ($this->tenantId !== null && $this->tenantId !== '' && tenant() === null) {
            Tenancy::initialize($this->tenantId);
            $ownsTenancy = true;
        }

        try {
            $recipient = User::query()->where('email', $this->email)->first(['locale']);
            if ($recipient !== null) {
                App::setLocale(AppLocale::normalize(is_string($recipient->locale) ? $recipient->locale : null));
            }

            match ($this->format) {
                'pdf' => $this->sendPdf($pdf, $periods),
                'csv' => $this->sendCsv($report),
                default => throw new \InvalidArgumentException("Unsupported report format [{$this->format}]."),
            };
        } finally {
            if ($ownsTenancy) {
                Tenancy::end();
            }
        }
    }

    private function sendCsv(BuildCampaignReport $report): void
    {
        $data = $report->handle();
        $csv = "metric,value\n".collect($data)->map(fn ($v, $k) => "{$k},{$v}")->implode("\n");

        Mail::to($this->email)->send(new CampaignReportMail($csv));
    }

    private function sendPdf(BuildQuarterlyPdfReport $pdf, ResolveBusinessReportPeriod $periods): void
    {
        $stored = DB::table('organization_settings')->value('timezone');
        $timezone = is_string($stored) && $stored !== '' ? $stored : 'UTC';
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
