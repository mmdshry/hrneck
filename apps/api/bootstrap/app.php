<?php

use App\Http\Middleware\ApplyFilamentTenantContext;
use App\Http\Middleware\EnsureOrgMembership;
use App\Http\Middleware\EnsurePlatformStaff;
use App\Http\Middleware\SetPermissionsTeamFromTenant;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->statefulApi();
        // Livewire updates use the web stack, not Filament panel middleware.
        // Without this, tenant resources query hrneck_central and 500.
        $middleware->web(append: [
            ApplyFilamentTenantContext::class,
        ]);
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'org.membership' => EnsureOrgMembership::class,
            'org.team' => SetPermissionsTeamFromTenant::class,
            'platform.staff' => EnsurePlatformStaff::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
