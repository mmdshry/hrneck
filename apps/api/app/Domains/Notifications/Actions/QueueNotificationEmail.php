<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\Notifications\Jobs\SendNotificationEmailJob;
use App\Domains\Notifications\Support\NotificationEmailGate;

class QueueNotificationEmail
{
    public function __construct(private readonly NotificationEmailGate $gate) {}

    /**
     * $tenantId is the organization the recipient belongs to. The email footer names that organization's address.
     */
    public function handle(string $email, string $subject, string $body, ?string $locale = null, ?string $tenantId = null): void
    {
        if (! $this->gate->allows($email)) {
            return;
        }

        SendNotificationEmailJob::dispatch($email, $subject, $body, $locale, $tenantId)
            ->onConnection((string) config('queue.notification_connection'));
    }
}
