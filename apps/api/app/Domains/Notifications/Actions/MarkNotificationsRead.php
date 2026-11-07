<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\Notifications\Models\UserNotification;
use Illuminate\Support\Carbon;

class MarkNotificationsRead
{
    /**
     * @param  list<int>|null  $ids
     * @return int Number of rows updated
     */
    public function handle(int $userId, ?array $ids = null, bool $all = false): int
    {
        $query = UserNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at');

        if (! $all) {
            if ($ids === null || $ids === []) {
                return 0;
            }
            $query->whereIn('id', $ids);
        }

        return $query->update(['read_at' => Carbon::now()]);
    }
}
