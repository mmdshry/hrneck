<?php

namespace App\Filament\Resources\ReportArchives\Pages;

use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Filament\Resources\ReportArchives\ReportArchiveResource;
use App\Support\FilamentTenant;

class ManageReportArchives extends ManageTenantRecords
{
    protected static string $resource = ReportArchiveResource::class;

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Report archives' : 'Report archives — select an organization';
    }
}
