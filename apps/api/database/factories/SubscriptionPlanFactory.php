<?php

namespace Database\Factories;

use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Support\PlanFeature;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SubscriptionPlan>
 */
class SubscriptionPlanFactory extends Factory
{
    protected $model = SubscriptionPlan::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'slug' => fake()->unique()->slug(3),
            'sort_order' => 0,
            'max_employees' => null,
            'max_users' => null,
            'features' => PlanFeature::map(true),
            'monthly_price' => null,
            'currency' => 'USD',
            'is_default' => false,
            'is_active' => true,
        ];
    }

    public function asDefault(): static
    {
        return $this->state(fn (): array => ['is_default' => true]);
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['is_active' => false]);
    }

    public function limited(?int $maxEmployees, ?int $maxUsers): static
    {
        return $this->state(fn (): array => [
            'max_employees' => $maxEmployees,
            'max_users' => $maxUsers,
        ]);
    }

    /**
     * @param  array<string, bool>  $features
     */
    public function withFeatures(array $features): static
    {
        return $this->state(fn (array $attributes): array => [
            'features' => array_merge($attributes['features'] ?? PlanFeature::map(true), $features),
        ]);
    }
}
