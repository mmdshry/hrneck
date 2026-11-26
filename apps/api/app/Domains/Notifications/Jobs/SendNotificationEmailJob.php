<?php

namespace App\Domains\Notifications\Jobs;

use App\Domains\Notifications\Mails\BrandedNotificationMail;
use App\Domains\Notifications\Support\NotificationEmailGate;
use App\Support\AppLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendNotificationEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $email,
        public string $subject,
        public string $body,
        public ?string $locale = null,
    ) {}

    public function handle(NotificationEmailGate $gate): void
    {
        if (! $gate->allows($this->email)) {
            return;
        }

        if ($this->locale !== null && $this->locale !== '') {
            App::setLocale(AppLocale::normalize($this->locale));
        }

        try {
            Mail::to($this->email)->send(BrandedNotificationMail::fromPlainBody($this->subject, $this->body));
        } catch (Throwable $e) {
            report($e);
        }
    }
}
