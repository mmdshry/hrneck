<?php

namespace App\Domains\Notifications\Mails;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Generic HRNECK-branded email: an HTML layout with a plain-text alternative.
 */
class BrandedNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * A trailing "<label>: <https://...>" line, as produced by the localized
     * notification strings (Open, Öffnen, Abrir, Ouvrir :, Открыть, ...).
     */
    private const TRAILING_LINK = '/^[^:]{1,40}:\s*(https?:\/\/\S+)$/u';

    /**
     * @param  list<string>  $lines
     * @param  list<array{label: string, url: string}>  $actions
     */
    public function __construct(
        public string $subjectLine,
        public string $title,
        public array $lines = [],
        public array $actions = [],
    ) {}

    /**
     * Build from a plain-text body. The last line, when it is a "<label>: <url>" link,
     * becomes the call-to-action button; every other non-empty line becomes a paragraph.
     */
    public static function fromPlainBody(string $subject, string $body): self
    {
        $lines = array_values(array_filter(
            array_map('trim', preg_split('/\R/u', $body) ?: []),
            static fn (string $line): bool => $line !== '',
        ));

        $actions = [];
        $lastIndex = array_key_last($lines);
        if ($lastIndex !== null && preg_match(self::TRAILING_LINK, $lines[$lastIndex], $match) === 1) {
            $actions[] = ['label' => 'Open', 'url' => $match[1]];
            array_pop($lines);
        }

        return new self(subjectLine: $subject, title: $subject, lines: $lines, actions: $actions);
    }

    public static function passwordReset(string $resetUrl, int $expiresInMinutes): self
    {
        return new self(
            subjectLine: 'Reset your '.config('brand.short').' password',
            title: 'Reset your password',
            lines: [
                'We received a request to reset the password for your account.',
                "This link expires in {$expiresInMinutes} minutes. If you did not request a reset, you can ignore this email.",
            ],
            actions: [['label' => 'Reset password', 'url' => $resetUrl]],
        );
    }

    public static function employeeInvite(string $setPasswordUrl, int $expiresInDays): self
    {
        return new self(
            subjectLine: "You're invited to ".config('brand.short'),
            title: 'Set your password',
            lines: [
                'An administrator has created a '.config('brand.short').' account for you.',
                "Set your password using the button below. This link expires in {$expiresInDays} days. If you were not expecting this invitation, you can ignore this email.",
            ],
            actions: [['label' => 'Set your password', 'url' => $setPasswordUrl]],
        );
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.branded',
            text: 'mail.branded-text',
        );
    }
}
