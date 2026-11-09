<?php

namespace App\Filament\Resources\Enrollments\Pages;

use App\Filament\Resources\Enrollments\EnrollmentResource;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Support\FilamentTenant;
use Filament\Actions\CreateAction;

class ManageEnrollments extends ManageTenantRecords
{
    protected static string $resource = EnrollmentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->visible(fn (): bool => FilamentTenant::has()),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Enrollments' : 'Enrollments — select an organization';
    }
}
