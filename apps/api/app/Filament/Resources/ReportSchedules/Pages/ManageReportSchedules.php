<?php

namespace App\Filament\Resources\ReportSchedules\Pages;

use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Filament\Resources\ReportSchedules\ReportScheduleResource;
use App\Support\FilamentTenant;
use Filament\Actions\CreateAction;

class ManageReportSchedules extends ManageTenantRecords
{
    protected static string $resource = ReportScheduleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->visible(fn (): bool => FilamentTenant::has())
                ->using(fn (array $data): ReportSchedule => ReportScheduleResource::persist(null, $data)),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Report schedules' : 'Report schedules — select an organization';
    }
}
