<?php

namespace App\Domains\Subscriptions\Exceptions;

use App\Domains\Subscriptions\Support\PlanLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class PlanLimitReached extends RuntimeException
{
    public function __construct(
        public readonly PlanLimit $limit,
        public readonly ?int $maximum,
        public readonly int $usage,
        public readonly bool $subscriptionInactive = false,
    ) {
        parent::__construct($subscriptionInactive
            ? 'The subscription is not active, so new '.$limit->label().' cannot be added.'
            : sprintf('Plan limit reached: up to %d %s allowed, %d in use.', (int) $maximum, $limit->label(), $usage));
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => 'plan_limit_reached',
            'resource' => $this->limit->value,
            'limit' => $this->maximum,
            'usage' => $this->usage,
        ], 403);
    }

    public function toValidationException(string $field): ValidationException
    {
        return ValidationException::withMessages([$field => [$this->getMessage()]]);
    }
}
