<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOrgMembership
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $tenantId = tenant('id');
        if (! is_string($tenantId) || $tenantId === '') {
            abort(400, 'Tenant context is required.');
        }

        if ($user->tenant_id !== $tenantId) {
            abort(403, 'You do not belong to this organization.');
        }

        return $next($request);
    }
}
