<?php

namespace App\Console\Commands;

use App\Domains\Notifications\Mails\BrandedNotificationMail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SmtpSmokeCommand extends Command
{
    protected $signature = 'hrneck:smtp-smoke';

    protected $description = 'Optional SMTP smoke send (requires HRNECK_SMTP_SMOKE=1)';

    public function handle(): int
    {
        if (! filter_var(env('HRNECK_SMTP_SMOKE', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->warn('Set HRNECK_SMTP_SMOKE=1 to send a real smoke email.');

            return self::FAILURE;
        }

        $to = (string) config('brand.support_address', 'support@hrneck.com');
        Mail::to($to)->send(new BrandedNotificationMail(
            subjectLine: config('brand.short').' SMTP smoke',
            title: 'SMTP smoke test',
            lines: ['This is a test email from '.config('brand.short').'. If you can read it, outgoing mail is working.'],
        ));

        $this->info('Smoke email queued/sent to '.$to);

        return self::SUCCESS;
    }
}
