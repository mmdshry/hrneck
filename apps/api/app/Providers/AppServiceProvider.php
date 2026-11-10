<?php

namespace App\Providers;

use App\Models\User;
use App\Support\StaffTenant;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
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

        RateLimiter::for('auth-login', function (Request $request) {
            $email = strtolower((string) $request->input('email', ''));
            // Local/testing runs many sequential browser logins (Playwright); keep prod tight.
            $perMinute = app()->environment(['local', 'testing']) ? 120 : 5;

            return [
                Limit::perMinute($perMinute)->by('auth-ip:'.$request->ip()),
                Limit::perMinute($perMinute)->by('auth-email:'.$email.'|'.$request->ip()),
            ];
        });

        Gate::before(function ($user, string $ability) {
            if (! $user instanceof User) {
                return null;
            }

            // Never elevate platform ops tooling via staff tenant context.
            if (in_array($ability, ['viewHorizon', 'viewTelescope'], true)) {
                return null;
            }

            $tenantId = tenant('id');
            if (
                $user->isPlatformStaff()
                && is_string($tenantId)
                && $tenantId !== ''
                && StaffTenant::matches($tenantId)
            ) {
                return true;
            }

            return null;
        });

        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $email = urlencode((string) $notifiable->getEmailForPasswordReset());
            $base = rtrim((string) config('brand.frontend_url'), '/');

            return "{$base}/login/reset?token={$token}&email={$email}";
        });

        Feature::define('directory_sync', fn () => true);
        Feature::define('custom_domains', fn () => true);
        Feature::define('advanced_reporting', fn () => true);
        Feature::define('automation_rules', fn () => true);
        Feature::define('white_label', fn () => true);
        Feature::define('learner_portal', fn () => true);
    }
}
