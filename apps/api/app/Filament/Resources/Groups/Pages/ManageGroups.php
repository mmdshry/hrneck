<?php

namespace App\Filament\Resources\Groups\Pages;

use App\Filament\Resources\Groups\GroupResource;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Support\FilamentTenant;
use Filament\Actions\CreateAction;

class ManageGroups extends ManageTenantRecords
{
    protected static string $resource = GroupResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->visible(fn (): bool => FilamentTenant::has()),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Groups' : 'Groups — select an organization';
    }
}
