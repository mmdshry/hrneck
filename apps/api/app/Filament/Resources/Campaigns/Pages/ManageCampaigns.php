<?php

namespace App\Filament\Resources\Campaigns\Pages;

use App\Domains\Campaigns\Actions\LaunchTrainingCampaign;
use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Campaigns\Models\Campaign;
use App\Filament\Resources\Campaigns\CampaignResource;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Support\FilamentTenant;
use Filament\Actions\CreateAction;

class ManageCampaigns extends ManageTenantRecords
{
    protected static string $resource = CampaignResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->visible(fn (): bool => FilamentTenant::has())
                ->using(function (array $data): Campaign {
                    $targetIds = app(ResolveCampaignAudience::class)->handle(
                        $data['target_ids'] ?? [],
                        $data['group_ids'] ?? [],
                    );
                    $launch = (bool) ($data['launch_now'] ?? true);
                    unset($data['target_ids'], $data['group_ids'], $data['launch_now']);

                    $campaign = Campaign::query()->create($data + [
                        'type' => 'training',
                        'status' => 'draft',
                    ]);

                    if ($launch && $targetIds !== []) {
                        app(LaunchTrainingCampaign::class)->handle($campaign, $targetIds);
                    }

                    return $campaign->fresh() ?? $campaign;
                }),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Campaigns' : 'Campaigns — select an organization';
    }
}
