<?php

namespace Database\Seeders;

use App\Domains\IdentityAccess\Actions\SeedRbacCatalog;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Throwable;

/**
 * Platform super admin accounts for named staff. Safe to run again: existing accounts are kept and only their
 * platform role and sign-in state are ensured. New accounts get a random password and a set-password link.
 *
 * Run on its own, never as a plain `db:seed` on production (DatabaseSeeder runs the demo data reset):
 *   php artisan db:seed --class=PlatformStaffSeeder --force
 */
class PlatformStaffSeeder extends Seeder
{
    /** @var array<string, string> Email => display name. */
    private const ACCOUNTS = [
        'hamed.fazli@itneck.com' => 'Hamed Fazli',
        'hadi.fazli@itneck.com' => 'Hadi Fazli',
        'mo.fard@itneck.com' => 'Mo Fard',
    ];

    public function run(): void
    {
        app(SeedRbacCatalog::class)->handle();
        setPermissionsTeamId(null);

        foreach (self::ACCOUNTS as $email => $name) {
            $this->ensureAccount($email, $name);
        }
    }

    private function ensureAccount(string $email, string $name): void
    {
        // Platform accounts have no organization. An organization login with the same email is a different account.
        $user = User::query()->withEmail($email)->whereNull('tenant_id')->first();
        $isNew = $user === null;
        $user ??= new User(['name' => $name, 'email' => $email, 'password' => Str::password(32)]);

        $user->forceFill([
            'tenant_id' => null,
            'email_verified_at' => $user->email_verified_at ?? now(),
            'must_set_password' => false,
            'disabled_at' => null,
        ])->save();

        setPermissionsTeamId(null);
        $user->syncRoles([OrgPermissionCatalog::PLATFORM_SUPER_ADMIN]);

        if (! $isNew) {
            $this->command?->info("Ensured {$email} (existing platform account).");

            return;
        }

        try {
            $status = Password::broker()->sendResetLink([
                'email' => $user->email,
                'tenant_id' => null,
            ]);
        } catch (Throwable $e) {
            report($e);
            $status = $e->getMessage();
        }

        if ($status === Password::RESET_LINK_SENT) {
            $this->command?->info("Created {$email}; set-password link sent.");

            return;
        }

        // The account exists either way; the link can still be requested from the staff host's "forgot password".
        $this->command?->warn("Created {$email}, but the set-password link was not sent: {$status}");
    }
}
