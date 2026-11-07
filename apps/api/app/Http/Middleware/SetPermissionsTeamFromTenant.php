<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetPermissionsTeamFromTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = tenant('id');
        if (is_string($tenantId) && $tenantId !== '') {
            setPermissionsTeamId($tenantId);
        }

        try {
            return $next($request);
        } finally {
            setPermissionsTeamId(null);
        }
    }
}
