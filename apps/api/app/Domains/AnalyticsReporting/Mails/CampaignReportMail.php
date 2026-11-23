<?php

namespace App\Domains\AnalyticsReporting\Mails;

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
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectLine ?? __('notifications.campaign_report_subject', [
                'brand' => config('brand.short'),
            ]),
        );
    }

    public function content(): Content
    {
        return new Content(
            text: 'mail.campaign-report',
            with: ['csvBody' => $this->csvBody],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        if ($this->pdfBinary === null || $this->pdfBinary === '') {
            return [];
        }

        return [
            Attachment::fromData(fn (): string => $this->pdfBinary, $this->pdfName ?? 'report.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
