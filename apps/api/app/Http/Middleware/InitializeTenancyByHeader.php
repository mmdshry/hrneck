<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Stancl\Tenancy\Tenancy;
use Symfony\Component\HttpFoundation\Response;

class InitializeTenancyByHeader
{
    public function __construct(private readonly Tenancy $tenancy) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->header('X-Tenant') ?: $request->query('tenant');
        if (! $tenantId) {
            abort(400, 'X-Tenant header is required.');
        }

        $tenant = Tenant::query()->find($tenantId);
        if (! $tenant) {
            // Same status as membership denial to avoid tenant-id enumeration.
            abort(403, 'Unauthorized for this tenant.');
        }

        $this->tenancy->initialize($tenant);

        return $next($request);
    }
}
