<?php

namespace App\Domains\Campaigns\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class CampaignWindow
{
    public static function parse(mixed $value): ?CarbonInterface
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return Carbon::parse($value);
    }

    public static function startsLater(?CarbonInterface $startsAt): bool
    {
        return $startsAt !== null && $startsAt->isFuture();
    }

    /**
     * The expiration must come after the start. A missing start counts as now,
     * because the campaign begins as soon as it launches.
     */
    public static function assertOrdered(?CarbonInterface $startsAt, ?CarbonInterface $expiresAt): void
    {
        if ($expiresAt === null) {
            return;
        }

        if ($expiresAt->lessThanOrEqualTo($startsAt ?? now())) {
            throw ValidationException::withMessages([
                'expires_at' => ['The expiration must be after the start time.'],
            ]);
        }
    }
}
