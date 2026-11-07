<?php

namespace App\Filament\Pages;

use App\Domains\DirectorySync\Actions\RunDirectorySync;
use App\Support\FilamentTenant;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

class IntegrationsSettings extends Page
{
    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-puzzle-piece';

    protected static ?string $navigationLabel = 'Integrations';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant settings';

    protected static ?int $navigationSort = 24;

    protected static ?string $slug = 'integrations';

    protected string $view = 'filament.pages.integrations-settings';

    public function getSmtpStatus(): array
    {
        $configured = filled(config('mail.mailers.smtp.host'))
            && filled(config('mail.mailers.smtp.username'));

        return [
            'status' => $configured ? 'connected' : 'disconnected',
            'host' => config('mail.mailers.smtp.host'),
            'port' => config('mail.mailers.smtp.port'),
            'from' => config('mail.from.address'),
            'support' => config('brand.support_address'),
        ];
    }

    public function runDirectorySync(): void
    {
        if (! FilamentTenant::has()) {
            Notification::make()->title('Select an organization first')->danger()->send();

            return;
        }
        $result = app(RunDirectorySync::class)->handle();
        Notification::make()
            ->title('Mock directory sync finished')
            ->body('Users: '.($result['users'] ?? 0).' / Groups: '.($result['groups'] ?? 0))
            ->success()
            ->send();
    }
}
