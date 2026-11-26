<?php

namespace App\Domains\Subscriptions\Models;

use App\Domains\Subscriptions\Support\PlanFeature;
use App\Domains\Subscriptions\Support\PlanLimit;
use Database\Factories\SubscriptionPlanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property int $sort_order
 * @property int|null $max_employees
 * @property int|null $max_users
 * @property array<string, bool> $features
 * @property string|null $monthly_price
 * @property string|null $currency
 * @property bool $is_default
 * @property bool $is_active
 */
#[Fillable([
    'name',
    'slug',
    'sort_order',
    'max_employees',
    'max_users',
    'features',
    'monthly_price',
    'currency',
    'is_default',
    'is_active',
])]
#[UseFactory(SubscriptionPlanFactory::class)]
class SubscriptionPlan extends Model
{
    use CentralConnection, HasFactory;

    /** @return HasMany<TenantSubscription, $this> */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class, 'subscription_plan_id');
    }

    /** @param  Builder<static>  $query */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function limitFor(PlanLimit $limit): ?int
    {
        return match ($limit) {
            PlanLimit::Employees => $this->max_employees,
            PlanLimit::Users => $this->max_users,
        };
    }

    public function includesFeature(PlanFeature $feature): bool
    {
        return (bool) ($this->features[$feature->value] ?? false);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'features' => 'array',
            'sort_order' => 'integer',
            'max_employees' => 'integer',
            'max_users' => 'integer',
            'monthly_price' => 'decimal:2',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
