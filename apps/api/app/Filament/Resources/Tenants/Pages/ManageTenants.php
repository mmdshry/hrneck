<?php

namespace App\Filament\Resources\Tenants\Pages;

use App\Domains\Tenancy\Actions\ProvisionTenant;
use App\Filament\Resources\Tenants\TenantResource;
use App\Models\Tenant;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageTenants extends ManageRecords
{
    protected static string $resource = TenantResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->using(function (array $data): Tenant {
                    return app(ProvisionTenant::class)->handle($data);
                }),
        ];
    }
}
