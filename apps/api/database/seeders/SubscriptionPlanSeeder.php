<?php

namespace Database\Seeders;

use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Support\PlanFeature;
use Illuminate\Database\Seeder;

class SubscriptionPlanSeeder extends Seeder
{
    public function run(): void
    {
        SubscriptionPlan::query()->firstOrCreate(
            ['slug' => 'standard'],
            [
                'name' => 'Standard',
                'sort_order' => 10,
                'max_employees' => null,
                'max_users' => null,
                'features' => PlanFeature::map(true),
                'currency' => 'USD',
                'is_default' => true,
                'is_active' => true,
            ],
        );

        SubscriptionPlan::query()->firstOrCreate(
            ['slug' => 'starter'],
            [
                'name' => 'Starter',
                'sort_order' => 20,
                'max_employees' => 25,
                'max_users' => 3,
                'features' => array_merge(PlanFeature::map(false), [
                    PlanFeature::Training->value => true,
                    PlanFeature::LearnerPortal->value => true,
                ]),
                'currency' => 'USD',
                'is_default' => false,
                'is_active' => true,
            ],
        );
    }
}
