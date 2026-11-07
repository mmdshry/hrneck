<?php

namespace Database\Seeders;

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\SeedRbacCatalog;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
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
        $adminRole = \App\Models\Role::findOrCreate(OrgPermissionCatalog::PLATFORM_SUPER_ADMIN, OrgPermissionCatalog::GUARD);

        $admin = User::query()->updateOrCreate(
            ['email' => config('brand.demo_admin_email')],
            [
                'name' => 'HRNECK Admin',
                'password' => Hash::make((string) config('brand.demo_admin_password')),
                'tenant_id' => null,
                'mfa_enabled' => false,
            ],
        );
        $admin->syncRoles([$adminRole]);

        $base = (string) config('brand.tenancy_base_domain');

        // Clear org users before deleting tenants (FK).
        User::query()->whereNotNull('tenant_id')->delete();
        DB::table('domains')->delete();
        DB::table('tenants')->delete();

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

        Artisan::call('tenants:migrate', ['--force' => true]);
        Artisan::call('tenants:seed', [
            '--class' => TenantSampleSeeder::class,
            '--force' => true,
        ]);
    }
}
