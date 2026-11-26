<?php

namespace App\Domains\Assistant\Support;

enum AssistantPendingActionStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Cancelled = 'cancelled';
    case Failed = 'failed';
    case Expired = 'expired';
}
