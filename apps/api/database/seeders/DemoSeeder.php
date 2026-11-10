<?php

namespace Database\Seeders;

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\SeedRbacCatalog;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\Tenancy\Actions\ProvisionTenant;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    public function run(): void
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

        $base = (string) config('brand.tenancy_base_domain');

        // Reset built-in demo orgs (includes mmdshry local company).
        $demoTenantIds = ['itneck', 'test', 'company', 'mmdshry'];
        User::query()->whereIn('tenant_id', $demoTenantIds)->delete();
        User::query()->whereIn('email', [
            'unshields@gmail.com',
            'test@mmdshry.com',
            ...array_map(static fn (int $n): string => "employee{$n}@mmdshry.com", range(1, 10)),
        ])->delete();
        DB::table('domains')->whereIn('tenant_id', $demoTenantIds)->delete();
        DB::table('tenants')->whereIn('id', $demoTenantIds)->delete();

        foreach ([
            ['id' => 'itneck', 'name' => 'ITneck', 'industry' => 'Technology', 'employee_band' => '11-50'],
            ['id' => 'test', 'name' => 'Test Org', 'industry' => 'Education', 'employee_band' => '1-10'],
            ['id' => 'company', 'name' => 'Company Org', 'industry' => 'Healthcare', 'employee_band' => '51-200'],
        ] as $org) {
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

            $rbac->ensureOrgAdminRole($org['id']);

            $orgEmail = 'admin@'.$org['id'].'.test';
            if (! User::query()->where('email', $orgEmail)->exists()) {
                app(CreateOrgUser::class)->handle(
                    $org['id'],
                    $org['name'].' Admin',
                    $orgEmail,
                    (string) config('brand.demo_admin_password'),
                    [OrgPermissionCatalog::ORG_ADMIN],
                );
            }
        }

        // migrate-fresh clears stale tenant rows without DROP DATABASE (safer under RefreshDatabase).
        // tenants:migrate-fresh has no --force flag (unlike tenants:seed / migrate).
        Artisan::call('tenants:migrate-fresh', [
            '--tenants' => ['itneck', 'test', 'company'],
        ]);
        Artisan::call('tenants:seed', [
            '--tenants' => ['itneck', 'test', 'company'],
            '--class' => TenantSampleSeeder::class,
            '--force' => true,
        ]);

        $this->seedMmdshryOrg();
    }

    private function seedMmdshryOrg(): void
    {
        $slug = 'mmdshry';
        $password = '09190755375';

        if (! Tenant::query()->whereKey($slug)->exists()) {
            app(ProvisionTenant::class)->handle([
                'slug' => $slug,
                'name' => 'mmdshry',
                'industry' => 'Technology',
                'employee_band' => '11-50',
            ]);
        }

        Artisan::call('tenants:migrate-fresh', [
            '--tenants' => [$slug],
        ]);
        Artisan::call('tenants:seed', [
            '--tenants' => [$slug],
            '--class' => TenantSampleSeeder::class,
            '--force' => true,
        ]);

        app(CreateOrgUser::class)->handle(
            $slug,
            'MMDSHRY Admin',
            'unshields@gmail.com',
            $password,
            [OrgPermissionCatalog::ORG_ADMIN],
        );

        app(CreateOrgUser::class)->handle(
            $slug,
            'Test Employee',
            'test@mmdshry.com',
            $password,
            [OrgPermissionCatalog::LEARNER],
        );

        $firstNames = ['Sara', 'Reza', 'Neda', 'Ali', 'Mina', 'Omar', 'Leila', 'Hassan', 'Yasmin', 'Kian'];
        $lastNames = ['Ahmadi', 'Karimi', 'Hosseini', 'Mohammadi', 'Rahimi', 'Nouri', 'Jafari', 'Moradi', 'Kazemi', 'Rostami'];
        $departments = ['Engineering', 'Finance', 'HR', 'Operations', 'Sales'];

        tenancy()->initialize(Tenant::query()->findOrFail($slug));
        Target::query()->updateOrCreate(
            ['email' => 'test@mmdshry.com'],
            [
                'first_name' => 'Test',
                'last_name' => 'Employee',
                'department' => 'General',
                'status' => 'active',
            ],
        );
        tenancy()->end();

        foreach (range(1, 10) as $n) {
            $email = "employee{$n}@mmdshry.com";
            $first = $firstNames[$n - 1];
            $last = $lastNames[$n - 1];

            app(CreateOrgUser::class)->handle(
                $slug,
                "{$first} {$last}",
                $email,
                $password,
                [OrgPermissionCatalog::LEARNER],
            );

            tenancy()->initialize(Tenant::query()->findOrFail($slug));
            Target::query()->updateOrCreate(
                ['email' => $email],
                [
                    'first_name' => $first,
                    'last_name' => $last,
                    'department' => $departments[$n % count($departments)],
                    'status' => 'active',
                    'risk_score' => $n * 7,
                ],
            );
            tenancy()->end();
        }
    }
}
