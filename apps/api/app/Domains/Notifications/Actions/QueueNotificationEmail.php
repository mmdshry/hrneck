<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\Notifications\Jobs\SendNotificationEmailJob;
use App\Domains\Notifications\Support\NotificationEmailGate;

class QueueNotificationEmail
{
    public function __construct(private readonly NotificationEmailGate $gate) {}

    public function handle(string $email, string $subject, string $body, ?string $locale = null): void
    {
        if (! $this->gate->allows($email)) {
            return;
        }

        SendNotificationEmailJob::dispatch($email, $subject, $body, $locale)
            ->onConnection((string) config('queue.notification_connection'));
    }
}
