<?php

namespace App\Domains\Tenancy\Actions;

use App\Models\Tenant;
use App\Support\LoadTestMarkers;
use Illuminate\Support\Facades\DB;

class DeprovisionLoadTestTenant
{
    public function handle(Tenant $tenant): void
    {
        if (! LoadTestMarkers::isLoadTestTenantId($tenant->id)) {
            throw new \InvalidArgumentException('Only load-test tenants can be deleted from Filament.');
        }

        $db = LoadTestMarkers::databaseName($tenant->id);
        DB::statement("DROP DATABASE IF EXISTS `{$db}`");
        DB::table('domains')->where('tenant_id', $tenant->id)->delete();
        DB::table('tenants')->where('id', $tenant->id)->delete();
    }
}
