<?php

namespace App\Domains\IdentityAccess\Notifications;

use App\Domains\Notifications\Mails\BrandedNotificationMail;
use App\Domains\Tenancy\Support\TenantAddress;
use Illuminate\Notifications\Notification;

/**
 * Set-password invite for an employee account an administrator just created.
 * Uses its own password broker so the link lives longer than a normal reset link.
 */
class EmployeeInviteNotification extends Notification
{
    public const PASSWORD_BROKER = 'employee_invites';

    public function __construct(#[\SensitiveParameter] private readonly string $token) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): BrandedNotificationMail
    {
        $email = (string) $notifiable->email;
        $addresses = app(TenantAddress::class);
        $query = http_build_query([
            'token' => $this->token,
            'email' => $email,
            'tenant' => $notifiable->tenant_id,
            'invite' => 1,
        ]);
        $setPasswordUrl = $addresses->url($notifiable->tenant_id, '/login/reset?'.$query);
        $expiresInDays = (int) ceil((int) config('auth.passwords.'.self::PASSWORD_BROKER.'.expire') / 1440);

        return BrandedNotificationMail::employeeInvite(
            $setPasswordUrl,
            $expiresInDays,
            $addresses->loginUrl($notifiable->tenant_id),
        )->to($email);
    }
}
