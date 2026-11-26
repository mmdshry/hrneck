<?php

namespace App\Domains\Subscriptions\Actions;

use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Support\PlanFeature;
use Illuminate\Validation\ValidationException;

final class SaveSubscriptionPlan
{
    /**
     * Persists a plan and keeps exactly one default plan.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?SubscriptionPlan $plan = null): SubscriptionPlan
    {
        $isDefault = (bool) ($data['is_default'] ?? false);
        $isActive = (bool) ($data['is_active'] ?? true);

        if ($isDefault && ! $isActive) {
            throw ValidationException::withMessages([
                'is_default' => ['The default plan must be active.'],
            ]);
        }

        if ($plan?->is_default === true && ! $isDefault) {
            throw ValidationException::withMessages([
                'is_default' => ['Choose another default plan before unsetting this one.'],
            ]);
        }

        $model = $plan ?? new SubscriptionPlan;

        return $model->getConnection()->transaction(function () use ($model, $data, $isDefault, $isActive): SubscriptionPlan {
            if ($isDefault) {
                $others = SubscriptionPlan::query()->where('is_default', true);

                if ($model->exists) {
                    $others->whereKeyNot($model->getKey());
                }

                $others->update(['is_default' => false]);
            }

            $model->fill([
                'name' => (string) $data['name'],
                'slug' => strtolower((string) $data['slug']),
                'sort_order' => (int) ($data['sort_order'] ?? 0),
                'max_employees' => $this->nullableInt($data['max_employees'] ?? null),
                'max_users' => $this->nullableInt($data['max_users'] ?? null),
                'monthly_price' => filled($data['monthly_price'] ?? null) ? (string) $data['monthly_price'] : null,
                'currency' => filled($data['currency'] ?? null) ? strtoupper((string) $data['currency']) : null,
                'is_active' => $isActive,
                'is_default' => $isDefault,
                'features' => $this->normalizeFeatures($data['features'] ?? []),
            ])->save();

            return $model;
        });
    }

    private function nullableInt(mixed $value): ?int
    {
        return filled($value) ? (int) $value : null;
    }

    /**
     * Every feature key is stored explicitly so new features default to disabled.
     *
     * @param  array<string, mixed>  $features
     * @return array<string, bool>
     */
    private function normalizeFeatures(array $features): array
    {
        $normalized = [];

        foreach (PlanFeature::cases() as $feature) {
            $normalized[$feature->value] = (bool) ($features[$feature->value] ?? false);
        }

        return $normalized;
    }
}
