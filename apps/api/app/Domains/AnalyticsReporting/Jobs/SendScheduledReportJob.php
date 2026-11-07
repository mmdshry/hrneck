<?php

namespace App\Domains\AnalyticsReporting\Jobs;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class SendScheduledReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $email,
        public string $format = 'csv',
    ) {}

    public function handle(BuildCampaignReport $report, BuildQuarterlyPdfReport $pdf): void
    {
        match ($this->format) {
            'pdf' => $this->sendPdf($pdf),
            'csv' => $this->sendCsv($report),
            default => throw new \InvalidArgumentException("Unsupported report format [{$this->format}]."),
        };
    }

    private function sendCsv(BuildCampaignReport $report): void
    {
        $data = $report->handle();
        $csv = "metric,value\n".collect($data)->map(fn ($v, $k) => "{$k},{$v}")->implode("\n");

        Mail::to($this->email)->send(new CampaignReportMail($csv));
    }

    private function sendPdf(BuildQuarterlyPdfReport $pdf): void
    {
        $period = now()->format('Y').'-Q'.now()->quarter;
        $built = $pdf->handle($period);
        $binary = Storage::disk('local')->get($built['path']);
        if (! is_string($binary) || $binary === '') {
            throw new \RuntimeException('Scheduled PDF report was empty.');
        }

        Mail::to($this->email)->send(new CampaignReportMail(
            '',
            $binary,
            basename($built['path']),
        ));
    }
}
