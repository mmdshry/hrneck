<?php

namespace App\Filament\Pages;

use App\Models\Tenant;
use App\Models\User;
use Filament\Pages\Page;

class PlatformHealth extends Page
{
    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-heart';

    protected static ?string $navigationLabel = 'Platform health';

    protected static string|\UnitEnum|null $navigationGroup = 'Platform';

    protected static ?int $navigationSort = 2;

    protected static ?string $slug = 'platform-health';

    protected string $view = 'filament.pages.platform-health';

    public function getViewData(): array
    {
        return [
            'tenants' => Tenant::query()->count(),
            'users' => User::query()->count(),
            'mailer' => config('mail.default'),
            'smtpHost' => config('mail.mailers.smtp.host'),
            'smtpPort' => config('mail.mailers.smtp.port'),
            'frontend' => config('brand.frontend_url'),
            'horizonUrl' => url('/horizon'),
            'mspUrl' => rtrim((string) config('brand.frontend_url'), '/').'/msp',
        ];
    }
}
