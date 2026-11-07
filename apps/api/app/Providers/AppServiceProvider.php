<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Pennant\Feature;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('tenant-api', function (Request $request) {
            $tenant = $request->header('X-Tenant', 'central');
            $key = $tenant.'|'.($request->user()?->id ?: $request->ip());

            return Limit::perMinute(120)->by($key);
        });

        RateLimiter::for('mfa', function (Request $request) {
            $key = ($request->user()?->id ?: $request->ip()).'|'.$request->ip();

            return Limit::perMinute(5)->by($key);
        });

        Feature::define('directory_sync', fn () => true);
        Feature::define('custom_domains', fn () => true);
        Feature::define('advanced_reporting', fn () => true);
        Feature::define('automation_rules', fn () => true);
        Feature::define('white_label', fn () => true);
        Feature::define('learner_portal', fn () => true);
    }
}
