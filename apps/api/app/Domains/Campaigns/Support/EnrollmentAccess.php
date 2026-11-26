<?php

namespace App\Domains\Campaigns\Support;

enum EnrollmentAccess: string
{
    case Available = 'available';
    case Upcoming = 'upcoming';
    case Expired = 'expired';

    /** The reason shown to a learner who is blocked, or null when access is open. */
    public function message(): ?string
    {
        return match ($this) {
            self::Available => null,
            self::Upcoming => 'This training is not available yet.',
            self::Expired => 'This training has expired.',
        };
    }
}
