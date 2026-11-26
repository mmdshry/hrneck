<?php

namespace App\Http\Middleware;

use App\Domains\Subscriptions\Exceptions\SubscriptionReadOnly;
use App\Domains\Subscriptions\Support\TenantEntitlements;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Read-only subscriptions (expired, suspended, ended trial or term) can still read the org app.
 * Any request that would change tenant data is refused before it reaches a controller.
 */
class EnsureSubscriptionWritable
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function __construct(private readonly TenantEntitlements $entitlements) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->method(), self::SAFE_METHODS, true)) {
            return $next($request);
        }

        $tenantId = tenant('id');

        if (is_string($tenantId)) {
            $status = $this->entitlements->readOnlyStatus($tenantId);

            if ($status !== null) {
                throw new SubscriptionReadOnly($status);
            }
        }

        return $next($request);
    }
}
