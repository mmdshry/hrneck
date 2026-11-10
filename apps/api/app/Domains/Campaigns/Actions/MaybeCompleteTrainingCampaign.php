<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Realtime\Support\PublishLive;

class MaybeCompleteTrainingCampaign
{
    public function handle(Campaign|int $campaign): void
    {
        $model = $campaign instanceof Campaign
            ? $campaign
            : Campaign::query()->find($campaign);

        if ($model === null || $model->type !== 'training') {
            return;
        }

        if (! in_array($model->status, ['running', 'scheduled'], true)) {
            return;
        }

        $total = CampaignRecipient::query()->where('campaign_id', $model->id)->count();
        if ($total === 0) {
            return;
        }

        $open = CampaignRecipient::query()
            ->where('campaign_id', $model->id)
            ->whereNotIn('status', ['completed', 'failed'])
            ->count();

        if ($open > 0) {
            return;
        }

        $model->forceFill([
            'status' => 'completed',
            'ends_at' => now(),
        ])->save();

        PublishLive::metricsBundle();
    }
}
