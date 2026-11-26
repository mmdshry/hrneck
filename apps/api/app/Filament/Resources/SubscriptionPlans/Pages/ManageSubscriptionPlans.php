<?php

namespace App\Filament\Resources\SubscriptionPlans\Pages;

use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Filament\Resources\SubscriptionPlans\SubscriptionPlanResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageSubscriptionPlans extends ManageRecords
{
    protected static string $resource = SubscriptionPlanResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->using(fn (array $data): SubscriptionPlan => SubscriptionPlanResource::persistPlan($data)),
        ];
    }
}
