<?php

namespace App\Providers;

use App\Domains\Assistant\Support\AssistantRequestContext;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Notifications\Mails\BrandedNotificationMail;
use App\Domains\Subscriptions\Support\PlanFeature;
use App\Domains\Subscriptions\Support\TenantEntitlements;
use App\Http\Middleware\AuthenticateAssistantTool;
use App\Models\Tenant;
use App\Models\User;
use App\Support\StaffTenant;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Pennant\Feature;
use SocialiteProviders\Azure\Provider as AzureSocialiteProvider;
use SocialiteProviders\Manager\SocialiteWasCalled;

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
            // Playwright drives many org pages as one shared tenant admin; a 120/min bucket trips mid-suite
            // and silently drops reads (e.g. the ticket dialog's desk list). Keep prod tight.
            $perMinute = app()->environment(['local', 'testing']) ? 1200 : 120;

            return Limit::perMinute($perMinute)->by($key);
        });

        RateLimiter::for('mfa', function (Request $request) {
            $key = ($request->user()?->id ?: $request->ip()).'|'.$request->ip();

            return Limit::perMinute(5)->by($key);
        });

        // SSO takes three requests per sign-in (redirect, callback, exchange), so it has its own per-IP budget.
        RateLimiter::for('sso', function (Request $request) {
            $perMinute = app()->environment(['local', 'testing']) ? 300 : 30;

            return Limit::perMinute($perMinute)->by('sso-ip:'.$request->ip());
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

        // Chat messages wait on Copilot Studio, so they get a tighter per-user budget than other org APIs.
        RateLimiter::for('assistant-messages', function (Request $request) {
            $tenant = (string) $request->header('X-Tenant', 'central');

            return [
                Limit::perMinute(20)->by('assistant-user|'.$tenant.'|'.($request->user()?->id ?: $request->ip())),
                Limit::perMinute(300)->by('assistant-tenant|'.$tenant),
            ];
        });

        RateLimiter::for('assistant-tools', function (Request $request) {
            $context = $request->attributes->get(AuthenticateAssistantTool::CONTEXT_ATTRIBUTE);
            $key = $context instanceof AssistantRequestContext ? $context->conversation->id : $request->ip();

            return Limit::perMinute(120)->by('assistant-tools|'.$key);
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
                && in_array($ability, OrgPermissionCatalog::staffTenantPermissionsFor($user), true)
            ) {
                return true;
            }

            return null;
        });

        $resetUrl = static function (object $notifiable, string $token): string {
            $base = rtrim((string) config('brand.frontend_url'), '/');
            // The organization makes the link point at one specific login, since emails can repeat across organizations.
            $query = http_build_query([
                'token' => $token,
                'email' => (string) $notifiable->email,
                'tenant' => $notifiable->tenant_id,
            ]);

            return "{$base}/login/reset?{$query}";
        };

        ResetPassword::createUrlUsing($resetUrl);
        ResetPassword::toMailUsing(static function (object $notifiable, string $token) use ($resetUrl): BrandedNotificationMail {
            $expiresInMinutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

            return BrandedNotificationMail::passwordReset($resetUrl($notifiable, $token), $expiresInMinutes)
                ->to((string) $notifiable->email);
        });

        // socialiteproviders/microsoft-azure is registered under the "azure" driver name (see config/services.php).
        Event::listen(function (SocialiteWasCalled $event): void {
            $event->extendSocialite('azure', AzureSocialiteProvider::class);
        });

        foreach (PlanFeature::cases() as $planFeature) {
            Feature::define($planFeature->value, function (mixed $scope) use ($planFeature): bool {
                return $scope instanceof Tenant
                    && app(TenantEntitlements::class)->hasFeature((string) $scope->getKey(), $planFeature);
            });
        }
    }
}
