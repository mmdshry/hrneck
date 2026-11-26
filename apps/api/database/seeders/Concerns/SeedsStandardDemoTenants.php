<?php

namespace Database\Seeders\Concerns;

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\SeedRbacCatalog;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\TenantSampleSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

trait SeedsStandardDemoTenants
{
    /**
     * @return list<array{id: string, name: string, industry: string, employee_band: string}>
     */
    protected function standardDemoOrgs(): array
    {
        return [
            ['id' => 'itneck', 'name' => 'ITneck', 'industry' => 'Technology', 'employee_band' => '11-50'],
            ['id' => 'test', 'name' => 'Test Org', 'industry' => 'Education', 'employee_band' => '1-10'],
            ['id' => 'company', 'name' => 'Company Org', 'industry' => 'Healthcare', 'employee_band' => '51-200'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function standardDemoTenantIds(): array
    {
        return array_column($this->standardDemoOrgs(), 'id');
    }

    protected function seedPlatformAdmin(): void
    {
        $rbac = app(SeedRbacCatalog::class);
        $rbac->handle();

        setPermissionsTeamId(null);
        $adminRole = Role::findOrCreate(OrgPermissionCatalog::PLATFORM_SUPER_ADMIN, OrgPermissionCatalog::GUARD);

        $admin = User::query()->updateOrCreate(
            ['email' => config('brand.demo_admin_email')],
            [
                'name' => 'HRNECK Admin',
                'password' => Hash::make((string) config('brand.demo_admin_password')),
                'tenant_id' => null,
            ],
        );
        $admin->forceFill([
            'email_verified_at' => now(),
            'mfa_enabled' => false,
            'mfa_secret' => null,
            'mfa_confirmed_at' => null,
            'mfa_recovery_codes' => null,
        ])->save();
        $admin->syncRoles([$adminRole]);
    }

    /**
     * Reset and recreate the standard demo tenants + org admins.
     *
     * @param  list<string>  $extraTenantIds  Additional tenant ids to wipe from central (e.g. mmdshry).
     * @return list<string>
     */
    protected function seedStandardDemoTenants(array $extraTenantIds = []): array
    {
        $base = (string) config('brand.tenancy_base_domain');
        $orgs = $this->standardDemoOrgs();
        $tenantIds = array_values(array_unique([
            ...array_column($orgs, 'id'),
            ...$extraTenantIds,
        ]));

        $demoUserIds = User::query()
            ->where(function ($q) use ($tenantIds): void {
                $q->whereIn('tenant_id', $tenantIds)
                    ->orWhereHas('memberships', fn ($m) => $m->whereIn('tenant_id', $tenantIds));
            })
            ->pluck('id');
        if ($demoUserIds->isNotEmpty()) {
            DB::table('tenant_memberships')->whereIn('user_id', $demoUserIds)->delete();
            User::query()->whereIn('id', $demoUserIds)->delete();
        }

        DB::table('domains')->whereIn('tenant_id', $tenantIds)->delete();
        DB::table('tenants')->whereIn('id', $tenantIds)->delete();

        foreach ($orgs as $org) {
            DB::table('tenants')->insert([
                'id' => $org['id'],
                'name' => $org['name'],
                'industry' => $org['industry'],
                'employee_band' => $org['employee_band'],
                'status' => 'active',
                'training_enabled' => true,
                'data' => json_encode(['tenancy_db_name' => config('tenancy.database.prefix').$org['id']], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('domains')->insert([
                'domain' => $org['id'].'.'.$base,
                'tenant_id' => $org['id'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $dbName = config('tenancy.database.prefix').$org['id'];
            DB::statement("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }

        return array_column($orgs, 'id');
    }

    /**
     * Create the org admin account for each standard demo tenant.
     *
     * Call after {@see migrateAndSeedTenantSamples()}: every organization account gets a Target
     * in its tenant database, so the tenant schema must exist before accounts are created.
     */
    protected function seedStandardDemoOrgAdmins(): void
    {
        $rbac = app(SeedRbacCatalog::class);

        foreach ($this->standardDemoOrgs() as $org) {
            $rbac->ensureOrgAdminRole($org['id']);

            $orgEmail = 'admin@'.$org['id'].'.test';
            if (! User::query()->where('email', $orgEmail)->where('tenant_id', $org['id'])->exists()) {
                app(CreateOrgUser::class)->handle(
                    $org['id'],
                    $org['name'].' Admin',
                    $orgEmail,
                    (string) config('brand.demo_admin_password'),
                    [OrgPermissionCatalog::ORG_ADMIN],
                );
            }
        }
    }

    /**
     * @param  list<string>  $tenantIds
     */
    protected function migrateAndSeedTenantSamples(array $tenantIds, bool $fresh = true): void
    {
        if ($tenantIds === []) {
            return;
        }

        if ($fresh) {
            // migrate-fresh clears stale tenant rows without DROP DATABASE.
            Artisan::call('tenants:migrate-fresh', [
                '--tenants' => $tenantIds,
            ]);
        } else {
            Artisan::call('tenants:migrate', [
                '--tenants' => $tenantIds,
                '--force' => true,
            ]);
        }

        Artisan::call('tenants:seed', [
            '--tenants' => $tenantIds,
            '--class' => TenantSampleSeeder::class,
            '--force' => true,
        ]);
    }
}
