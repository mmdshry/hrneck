<?php

namespace Database\Factories;

use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Models\TenantSubscription;
use App\Domains\Subscriptions\Support\SubscriptionStatus;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TenantSubscription>
 */
class TenantSubscriptionFactory extends Factory
{
    protected $model = TenantSubscription::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => 'itneck',
            'subscription_plan_id' => SubscriptionPlan::factory(),
            'status' => SubscriptionStatus::Active,
            'starts_at' => now(),
            'trial_ends_at' => null,
            'ends_at' => null,
        ];
    }

    public function forTenant(string $tenantId): static
    {
        return $this->state(fn (): array => ['tenant_id' => $tenantId]);
    }

    public function forPlan(SubscriptionPlan $plan): static
    {
        return $this->state(fn (): array => ['subscription_plan_id' => $plan->getKey()]);
    }

    public function withStatus(SubscriptionStatus $status, ?CarbonInterface $endsAt = null): static
    {
        return $this->state(fn (): array => [
            'status' => $status,
            'ends_at' => $status === SubscriptionStatus::Active ? $endsAt : null,
            'trial_ends_at' => $status === SubscriptionStatus::Trial ? $endsAt : null,
        ]);
    }
}
