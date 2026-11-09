<?php

namespace App\Filament\Resources\SendingProfiles\Pages;

use App\Domains\MailDelivery\Models\SendingProfile;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Filament\Resources\SendingProfiles\SendingProfileResource;
use App\Support\FilamentTenant;
use Filament\Actions\CreateAction;

class ManageSendingProfiles extends ManageTenantRecords
{
    protected static string $resource = SendingProfileResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->visible(fn (): bool => FilamentTenant::has())
                ->after(function (SendingProfile $record): void {
                    if ($record->is_default) {
                        SendingProfile::query()->whereKeyNot($record->id)->update(['is_default' => false]);
                    }
                }),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Sending profiles' : 'Sending profiles — select an organization';
    }
}
