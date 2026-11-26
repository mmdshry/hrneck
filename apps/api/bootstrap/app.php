<?php

use App\Http\Middleware\ApplyFilamentTenantContext;
use App\Http\Middleware\EnsureOrgMembership;
use App\Http\Middleware\EnsurePlanFeature;
use App\Http\Middleware\EnsurePlatformStaff;
use App\Http\Middleware\InitializeTenancyByHeader;
use App\Http\Middleware\SetPermissionsTeamFromTenant;
use App\Http\Middleware\SetUserLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
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
        // Avoid app()->environment() here — the container is not fully booted yet.
        $trustedProxies = env('TRUSTED_PROXIES');
        if ($trustedProxies === null) {
            $appEnv = (string) env('APP_ENV', 'production');
            $trustedProxies = in_array($appEnv, ['local', 'testing'], true) ? '*' : '';
        }
        if (is_string($trustedProxies) && $trustedProxies !== '') {
            $at = $trustedProxies === '*'
                ? '*'
                : array_values(array_filter(array_map('trim', explode(',', $trustedProxies))));
            if ($at === '*' || $at !== []) {
                $middleware->trustProxies(at: $at);
            }
        }
        $middleware->statefulApi();
        // Livewire updates use the web stack, not Filament panel middleware.
        // Without this, tenant resources query hrneck_central and 500.
        $middleware->web(append: [
            ApplyFilamentTenantContext::class,
            SetUserLocale::class,
        ]);
        // Tenant DB must be active before implicit route-model binding resolves
        // Target/Group/Department/etc., otherwise queries hit hrneck_central.
        $middleware->prependToPriorityList(
            before: SubstituteBindings::class,
            prepend: InitializeTenancyByHeader::class,
        );
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'org.membership' => EnsureOrgMembership::class,
            'org.team' => SetPermissionsTeamFromTenant::class,
            'platform.staff' => EnsurePlatformStaff::class,
            'plan.feature' => EnsurePlanFeature::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
