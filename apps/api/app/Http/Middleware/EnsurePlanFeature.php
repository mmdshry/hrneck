<?php

namespace App\Http\Middleware;

use App\Domains\Subscriptions\Exceptions\PlanFeatureDisabled;
use App\Domains\Subscriptions\Support\PlanFeature;
use App\Domains\Subscriptions\Support\TenantEntitlements;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlanFeature
{
    public function __construct(private readonly TenantEntitlements $entitlements) {}

    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $planFeature = PlanFeature::from($feature);
        $tenantId = tenant('id');

        if (! is_string($tenantId) || ! $this->entitlements->hasFeature($tenantId, $planFeature)) {
            throw new PlanFeatureDisabled($planFeature);
        }

        return $next($request);
    }
}
