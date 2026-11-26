<?php

namespace App\Domains\Subscriptions\Exceptions;

use App\Domains\Subscriptions\Support\SubscriptionStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

final class SubscriptionReadOnly extends RuntimeException
{
    public function __construct(public readonly SubscriptionStatus $status)
    {
        parent::__construct(sprintf(
            'This organization is read-only because its subscription is %s. You can still view data, but changes are blocked until a platform administrator renews it.',
            strtolower($status->label()),
        ));
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => 'subscription_read_only',
            'status' => $this->status->value,
        ], 403);
    }
}
