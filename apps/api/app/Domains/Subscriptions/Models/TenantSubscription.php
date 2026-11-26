<?php

namespace App\Domains\Subscriptions\Models;

use App\Domains\Subscriptions\Support\SubscriptionStatus;
use App\Models\Tenant;
use Carbon\CarbonInterface;
use Database\Factories\TenantSubscriptionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * @property int $id
 * @property string $tenant_id
 * @property int $subscription_plan_id
 * @property SubscriptionStatus $status
 * @property CarbonInterface|null $starts_at
 * @property CarbonInterface|null $trial_ends_at
 * @property CarbonInterface|null $ends_at
 */
#[Fillable([
    'tenant_id',
    'subscription_plan_id',
    'status',
    'starts_at',
    'trial_ends_at',
    'ends_at',
])]
#[UseFactory(TenantSubscriptionFactory::class)]
class TenantSubscription extends Model
{
    use CentralConnection, HasFactory;

    /** @return BelongsTo<SubscriptionPlan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Read-only subscriptions keep every read working in the org app, but block org writes.
     */
    public function isReadOnly(CarbonInterface $now): bool
    {
        return match ($this->status) {
            SubscriptionStatus::Suspended, SubscriptionStatus::Expired => true,
            SubscriptionStatus::Trial => $this->trial_ends_at !== null && $this->trial_ends_at->lte($now),
            SubscriptionStatus::Active => $this->ends_at !== null && $this->ends_at->lte($now),
        };
    }

    /**
     * The status to show: a trial or term whose end date has passed reads as expired even before the
     * scheduled job has stored that change.
     */
    public function effectiveStatus(CarbonInterface $now): SubscriptionStatus
    {
        return match ($this->status) {
            SubscriptionStatus::Suspended => SubscriptionStatus::Suspended,
            SubscriptionStatus::Expired => SubscriptionStatus::Expired,
            SubscriptionStatus::Trial, SubscriptionStatus::Active => $this->isReadOnly($now)
                ? SubscriptionStatus::Expired
                : $this->status,
        };
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => SubscriptionStatus::class,
            'starts_at' => 'datetime',
            'trial_ends_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }
}
