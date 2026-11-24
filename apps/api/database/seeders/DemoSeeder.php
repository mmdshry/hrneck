<?php

namespace Database\Seeders;

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\Tenancy\Actions\ProvisionTenant;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\Concerns\SeedsStandardDemoTenants;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

class DemoSeeder extends Seeder
{
    use SeedsStandardDemoTenants;

    public function run(): void
    {
        $this->seedPlatformAdmin();

        User::query()->whereIn('email', [
            'unshields@gmail.com',
            'test@mmdshry.com',
            ...array_map(static fn (int $n): string => "employee{$n}@mmdshry.com", range(1, 10)),
        ])->delete();

        $tenantIds = $this->seedStandardDemoTenants(extraTenantIds: ['mmdshry']);
        $this->migrateAndSeedTenantSamples($tenantIds, fresh: true);
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
