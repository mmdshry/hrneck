<?php

namespace App\Filament\Widgets;

use App\Models\Tenant;
use App\Models\User;
use App\Support\LoadTestMarkers;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class MspStatsOverview extends StatsOverviewWidget
{
    protected function getStats(): array
    {
        $tenants = Tenant::query()->count();
        $loadTest = Tenant::query()->where('id', 'like', LoadTestMarkers::TENANT_PREFIX.'%')->count();
        $users = User::query()->count();

        return [
            Stat::make('Organizations', (string) $tenants)
                ->description('Central tenants')
                ->icon('heroicon-o-building-office-2'),
            Stat::make('Load-test orgs', (string) $loadTest)
                ->description('Prefixed '.LoadTestMarkers::TENANT_PREFIX.'*')
                ->icon('heroicon-o-beaker'),
            Stat::make('Central users', (string) $users)
                ->description('MSP / partner accounts')
                ->icon('heroicon-o-users'),
        ];
    }
}
