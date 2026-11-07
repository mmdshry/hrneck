<?php

namespace App\Filament\Pages;

use App\Domains\CustomDomains\Actions\BuildDnsGuidance;
use App\Support\FilamentTenant;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Schema;
use Illuminate\Support\Facades\DB;

class DomainsSettings extends Page
{
    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-globe-alt';

    protected static ?string $navigationLabel = 'Domains';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant settings';

    protected static ?int $navigationSort = 22;

    protected static ?string $slug = 'domains';

    protected string $view = 'filament.pages.domains-settings';

    /** @var array<string, mixed> */
    public array $data = [];

    /** @var array<string, mixed>|null */
    public ?array $guidance = null;

    public function mount(): void
    {
        if (! FilamentTenant::has()) {
            return;
        }
        $settings = DB::table('organization_settings')->first();
        $meta = json_decode((string) ($settings->meta ?? '{}'), true) ?: [];
        $domain = (string) ($meta['sending_domain'] ?? '');
        $this->form->fill(['sending_domain' => $domain]);
        if ($domain !== '') {
            $this->guidance = app(BuildDnsGuidance::class)->handle($domain);
        }
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('sending_domain')->required()->maxLength(190),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        if (! FilamentTenant::has()) {
            Notification::make()->title('Select an organization first')->danger()->send();

            return;
        }
        $domain = strtolower((string) ($this->form->getState()['sending_domain'] ?? ''));
        $settings = DB::table('organization_settings')->first();
        $meta = json_decode((string) ($settings->meta ?? '{}'), true) ?: [];
        $meta['sending_domain'] = $domain;
        DB::table('organization_settings')->updateOrInsert(
            ['id' => 1],
            [
                'meta' => json_encode($meta, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
                'created_at' => $settings->created_at ?? now(),
            ],
        );
        $this->guidance = app(BuildDnsGuidance::class)->handle($domain);
        Notification::make()->title('Sending domain saved')->success()->send();
    }
}
