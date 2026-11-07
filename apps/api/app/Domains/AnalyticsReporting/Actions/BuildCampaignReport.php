<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TrainingLms\Models\Enrollment;

class BuildCampaignReport
{
    public function handle(?int $campaignId = null): array
    {
        $recipients = CampaignRecipient::query()
            ->when($campaignId, fn ($q) => $q->where('campaign_id', $campaignId))
            ->get();

        return [
            'campaigns' => Campaign::query()->count(),
            'recipients' => $recipients->count(),
            'sent' => $recipients->whereNotNull('sent_at')->count(),
            'opened' => $recipients->whereNotNull('opened_at')->count(),
            'clicked' => $recipients->whereNotNull('clicked_at')->count(),
            'submitted' => $recipients->whereNotNull('submitted_at')->count(),
            'reported' => $recipients->whereNotNull('reported_at')->count(),
            'enrollments' => Enrollment::query()->count(),
            'click_rate' => $recipients->count() > 0
                ? round(($recipients->whereNotNull('clicked_at')->count() / $recipients->count()) * 100, 1)
                : 0,
        ];
    }
}
