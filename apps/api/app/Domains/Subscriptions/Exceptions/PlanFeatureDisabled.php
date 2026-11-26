<?php

namespace App\Domains\Subscriptions\Exceptions;

use App\Domains\Subscriptions\Support\PlanFeature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

final class PlanFeatureDisabled extends RuntimeException
{
    public function __construct(public readonly PlanFeature $feature)
    {
        parent::__construct($feature->label().' is not available on the current subscription.');
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => 'plan_feature_disabled',
            'feature' => $this->feature->value,
        ], 403);
    }
}
