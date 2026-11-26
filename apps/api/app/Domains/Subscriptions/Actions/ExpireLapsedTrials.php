<?php

namespace App\Domains\Subscriptions\Actions;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Subscriptions\Models\TenantSubscription;
use App\Domains\Subscriptions\Support\SubscriptionStatus;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

final class ExpireLapsedTrials
{
    public function __construct(private readonly LogOrgActivity $audit) {}

    /**
     * Moves trials whose end date has passed to expired, which makes the organization read-only.
     * Platform staff can still change any status by hand afterwards.
     *
     * @return int number of subscriptions expired
     */
    public function handle(CarbonInterface $now): int
    {
        $expired = 0;

        TenantSubscription::query()
            ->where('status', SubscriptionStatus::Trial->value)
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', $now)
            ->chunkById(100, function (Collection $subscriptions) use (&$expired): void {
                foreach ($subscriptions as $subscription) {
                    $subscription->update(['status' => SubscriptionStatus::Expired]);

                    $this->audit->handle(
                        'subscriptions',
                        'tenant_subscription_expired',
                        'Trial ended; the organization is now read-only.',
                        $subscription,
                        [
                            'tenant_id' => $subscription->tenant_id,
                            'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
                            'source' => 'schedule',
                        ],
                    );

                    $expired++;
                }
            });

        if ($expired > 0) {
            PublishLive::msp();
        }

        return $expired;
    }
}
