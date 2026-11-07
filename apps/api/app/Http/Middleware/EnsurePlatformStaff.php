<?php

namespace App\Http\Middleware;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        setPermissionsTeamId(null);

        if (! $user->hasAnyRole(OrgPermissionCatalog::platformRoles())) {
            abort(403, 'Platform staff access required.');
        }

        return $next($request);
    }
}
