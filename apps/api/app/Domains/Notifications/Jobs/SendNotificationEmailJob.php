<?php

namespace App\Domains\Notifications\Jobs;

use App\Domains\Notifications\Mails\BrandedNotificationMail;
use App\Domains\Notifications\Support\NotificationEmailGate;
use App\Domains\Tenancy\Support\TenantAddress;
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
        public ?string $tenantId = null,
    ) {}

    public function handle(NotificationEmailGate $gate, TenantAddress $addresses): void
    {
        if (! $gate->allows($this->email)) {
            return;
        }

        if ($this->locale !== null && $this->locale !== '') {
            App::setLocale(AppLocale::normalize($this->locale));
        }

        $tenantId = is_string($this->tenantId) && $this->tenantId !== ''
            ? $this->tenantId
            : (is_string(tenant('id')) ? (string) tenant('id') : null);
        $loginUrl = $tenantId === null ? null : $addresses->loginUrl($tenantId);

        try {
            Mail::to($this->email)->send(BrandedNotificationMail::fromPlainBody($this->subject, $this->body, $loginUrl));
        } catch (Throwable $e) {
            report($e);
        }
    }
}
