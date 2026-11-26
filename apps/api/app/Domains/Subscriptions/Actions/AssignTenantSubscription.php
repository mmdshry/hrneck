<?php

namespace App\Domains\Subscriptions\Actions;

use App\Domains\Subscriptions\Models\TenantSubscription;
use App\Domains\Subscriptions\Support\SubscriptionStatus;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

final class AssignTenantSubscription
{
    /**
     * Creates or updates the single subscription record for an organization.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(string $tenantId, array $data): TenantSubscription
    {
        $status = SubscriptionStatus::from((string) $data['status']);
        $trialEndsAt = $this->parseDate($data['trial_ends_at'] ?? null);
        $endsAt = $this->parseDate($data['ends_at'] ?? null);

        if ($status === SubscriptionStatus::Trial && $trialEndsAt === null) {
            throw ValidationException::withMessages([
                'trial_ends_at' => ['A trial needs an end date.'],
            ]);
        }

        $existing = TenantSubscription::query()->where('tenant_id', $tenantId)->first();
        $planId = (int) $data['subscription_plan_id'];
        $planChanged = $existing === null || (int) $existing->subscription_plan_id !== $planId;

        $subscription = $existing ?? new TenantSubscription(['tenant_id' => $tenantId]);
        $subscription->fill([
            'subscription_plan_id' => $planId,
            'status' => $status,
            'starts_at' => $planChanged ? now() : $existing->starts_at,
            'trial_ends_at' => $status === SubscriptionStatus::Trial ? $trialEndsAt : null,
            'ends_at' => $endsAt,
        ])->save();

        return $subscription;
    }

    private function parseDate(mixed $value): ?Carbon
    {
        return filled($value) ? Carbon::parse((string) $value) : null;
    }
}
