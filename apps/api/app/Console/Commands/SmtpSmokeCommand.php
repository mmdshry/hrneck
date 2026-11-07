<?php

namespace App\Console\Commands;

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
        Mail::raw('HRNECK SMTP smoke test from '.config('brand.short'), function ($message) use ($to): void {
            $message->to($to)->subject(config('brand.short').' SMTP smoke');
        });

        $this->info('Smoke email queued/sent to '.$to);

        return self::SUCCESS;
    }
}
