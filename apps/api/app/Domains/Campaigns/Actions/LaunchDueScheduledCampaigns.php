<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\Campaign;
use Illuminate\Support\Facades\DB;
use Throwable;

class LaunchDueScheduledCampaigns
{
    public function __construct(private LaunchTrainingCampaign $launch) {}

    /**
     * Launches scheduled training campaigns whose start time has arrived.
     * Must run inside an initialized tenant. Returns how many campaigns launched.
     */
    public function handle(): int
    {
        $dueIds = Campaign::query()
            ->where('type', 'training')
            ->where('status', 'scheduled')
            ->whereNotNull('starts_at')
            ->where('starts_at', '<=', now())
            ->pluck('id');

        $launched = 0;
        foreach ($dueIds as $campaignId) {
            try {
                $wasLaunched = DB::transaction(function () use ($campaignId): bool {
                    $campaign = Campaign::query()->lockForUpdate()->find($campaignId);
                    if ($campaign === null || $campaign->status !== 'scheduled') {
                        return false;
                    }

                    $audience = $campaign->launchAudience();
                    if ($audience === null) {
                        return false;
                    }

                    $this->launch->handle($campaign, $audience['target_ids'], $audience['group_ids']);

                    return true;
                });
            } catch (Throwable $e) {
                report($e);

                continue;
            }

            if ($wasLaunched) {
                $launched++;
            }
        }

        return $launched;
    }
}
