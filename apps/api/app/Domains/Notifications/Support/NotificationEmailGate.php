<?php

namespace App\Domains\Notifications\Support;

use App\Domains\TargetsGroups\Models\Target;

final class NotificationEmailGate
{
    /**
     * Allow email unless a matching Target has notification_opt_out.
     * Org users with no Target always pass.
     */
    public function allows(string $email): bool
    {
        $normalized = strtolower(trim($email));
        if ($normalized === '') {
            return false;
        }

        $optedOut = Target::query()
            ->whereRaw('lower(email) = ?', [$normalized])
            ->value('notification_opt_out');

        if ($optedOut === null) {
            return true;
        }

        return ! (bool) $optedOut;
    }
}
