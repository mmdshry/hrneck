<?php

namespace App\Domains\AnalyticsReporting\Mails;

use App\Domains\AnalyticsReporting\Actions\BuildOrgDetailedReport;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CampaignReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $csvBody,
        public ?string $pdfBinary = null,
        public ?string $pdfName = null,
        public ?string $subjectLine = null,
        public ?string $csvAttachment = null,
        public ?string $csvAttachmentName = null,
        public bool $truncated = false,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectText());
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.campaign-report',
            text: 'mail.campaign-report-text',
            with: [
                'title' => $this->subjectText(),
                'summary' => $this->summaryText(),
                'csvBody' => $this->csvBody,
                'notice' => $this->truncated
                    ? __('notifications.campaign_report_truncated', ['limit' => BuildOrgDetailedReport::CSV_ROW_CAP])
                    : '',
            ],
        );
    }

    private function summaryText(): string
    {
        if ($this->hasPdf()) {
            return __('notifications.campaign_report_pdf_attached');
        }

        if ($this->hasCsvAttachment()) {
            return __('notifications.campaign_report_csv_attached');
        }

        return __('notifications.campaign_report_csv_inline');
    }

    private function hasPdf(): bool
    {
        return $this->pdfBinary !== null && $this->pdfBinary !== '';
    }

    private function hasCsvAttachment(): bool
    {
        return $this->csvAttachment !== null && $this->csvAttachment !== '';
    }

    private function subjectText(): string
    {
        return $this->subjectLine ?? __('notifications.campaign_report_subject', [
            'brand' => config('brand.short'),
        ]);
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        if ($this->hasCsvAttachment()) {
            return [
                Attachment::fromData(fn (): string => (string) $this->csvAttachment, $this->csvAttachmentName ?? 'report.csv')
                    ->withMime('text/csv'),
            ];
        }

        if (! $this->hasPdf()) {
            return [];
        }

        return [
            Attachment::fromData(fn (): string => (string) $this->pdfBinary, $this->pdfName ?? 'report.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
