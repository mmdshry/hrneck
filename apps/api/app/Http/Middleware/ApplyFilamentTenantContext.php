<?php

namespace App\Http\Middleware;

use App\Support\FilamentTenant;
use Closure;
use Illuminate\Http\Request;
use Stancl\Tenancy\Facades\Tenancy;
use Symfony\Component\HttpFoundation\Response;

class ApplyFilamentTenantContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = FilamentTenant::tenant();
        if ($tenant) {
            Tenancy::initialize($tenant);
        }

        try {
            return $next($request);
        } finally {
            if (tenancy()->initialized) {
                Tenancy::end();
            }
        }
    }
}
