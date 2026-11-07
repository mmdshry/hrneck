<?php

namespace App\Filament\Resources\Activities\Pages;

use App\Filament\Resources\Activities\ActivityResource;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Support\FilamentTenant;

class ManageActivities extends ManageTenantRecords
{
    protected static string $resource = ActivityResource::class;

    protected function getHeaderActions(): array
    {
        return [];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has()
            ? 'Activity log'
            : 'Activity log — select an organization';
    }
}
