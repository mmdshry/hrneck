<?php

namespace App\Filament\Widgets;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Support\FilamentTenant;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class TenantOpsOverview extends StatsOverviewWidget
{
    protected ?string $heading = 'Selected organization';

    public static function canView(): bool
    {
        return FilamentTenant::has();
    }

    protected function getStats(): array
    {
        return [
            Stat::make('Campaigns', (string) Campaign::query()->count())
                ->icon('heroicon-o-paper-airplane'),
            Stat::make('Targets', (string) Target::query()->count())
                ->icon('heroicon-o-user-group'),
            Stat::make('Enrollments', (string) Enrollment::query()->count())
                ->icon('heroicon-o-clipboard-document-check'),
        ];
    }
}
