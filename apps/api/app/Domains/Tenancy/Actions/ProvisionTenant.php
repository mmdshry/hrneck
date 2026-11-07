<?php

namespace App\Domains\Tenancy\Actions;

use App\Domains\IdentityAccess\Actions\SeedRbacCatalog;
use App\Domains\Realtime\Support\PublishLive;
use App\Models\Tenant;
use Database\Seeders\TenantSampleSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProvisionTenant
{
    /**
     * @param  array{
     *     id?: string,
     *     slug?: string,
     *     name: string,
     *     industry?: string|null,
     *     employee_band?: string|null,
     *     status?: string,
     *     training_enabled?: bool,
     * }  $data
     */
    public function handle(array $data): Tenant
    {
        $slug = Str::slug((string) ($data['id'] ?? $data['slug'] ?? ''));
        if ($slug === '') {
            throw new \InvalidArgumentException('Tenant slug is required.');
        }

        $name = (string) $data['name'];
        $domain = $slug.'.'.config('brand.tenancy_base_domain');
        $dbName = config('tenancy.database.prefix').$slug;

        if (DB::table('tenants')->where('id', $slug)->exists()) {
            throw new \InvalidArgumentException("Tenant [{$slug}] already exists.");
        }

        DB::table('tenants')->insert([
            'id' => $slug,
            'name' => $name,
            'industry' => $data['industry'] ?? null,
            'employee_band' => $data['employee_band'] ?? '1-10',
            'status' => $data['status'] ?? 'active',
            'training_enabled' => (bool) ($data['training_enabled'] ?? true),
            'data' => json_encode(['tenancy_db_name' => $dbName], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('domains')->insert([
            'domain' => $domain,
            'tenant_id' => $slug,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::statement("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        Artisan::call('tenants:migrate', ['--tenants' => [$slug], '--force' => true]);
        Artisan::call('tenants:seed', [
            '--tenants' => [$slug],
            '--class' => TenantSampleSeeder::class,
            '--force' => true,
        ]);

        app(SeedRbacCatalog::class)->ensureOrgAdminRole($slug);

        $tenant = Tenant::query()->findOrFail($slug)->load('domains');
        PublishLive::msp();

        return $tenant;
    }
}
