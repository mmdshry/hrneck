<?php

namespace App\Domains\Assistant\Tools\Training;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\User;

final class TrainingCampaignSummaryTool implements AssistantTool
{
    public function __construct(private readonly BuildCampaignReport $report) {}

    public function name(): string
    {
        return 'training_campaign_summary';
    }

    public function description(): string
    {
        return 'Get the training campaign funnel: campaigns, recipients, opened, completed, and no-action counts with percentages. Aggregates only, no individual names.';
    }

    public function permission(): string
    {
        return OrgPermissionCatalog::REPORTS_VIEW;
    }

    public function writes(): bool
    {
        return false;
    }

    public function rules(): array
    {
        return [];
    }

    public function run(array $input, User $actor): array
    {
        return ['summary' => $this->report->handle()];
    }

    public function summarize(array $input): string
    {
        return '';
    }
}
