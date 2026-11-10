<?php

namespace App\Filament\Pages;

use App\Support\FilamentTenant;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class OrgSettings extends Page
{
    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-adjustments-horizontal';

    protected static ?string $navigationLabel = 'Org settings';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant settings';

    protected static ?int $navigationSort = 20;

    protected static ?string $slug = 'org-settings';

    protected string $view = 'filament.pages.org-settings';

    public ?array $data = [];

    public static function shouldRegisterNavigation(): bool
    {
        return true;
    }

    public function mount(): void
    {
        if (! FilamentTenant::has()) {
            $this->data = [];

            return;
        }
        $row = DB::table('organization_settings')->first();
        $meta = json_decode((string) ($row->meta ?? '{}'), true) ?: [];
        $this->form->fill([
            'display_name' => $row->display_name ?? '',
            'primary_color' => $row->primary_color ?? '#083a6d',
            'timezone' => $row->timezone ?? 'UTC',
            'logo_path' => $row->logo_path ?? null,
            'sending_domain' => $meta['sending_domain'] ?? '',
            'webhook_url' => $meta['webhook_url'] ?? '',
        ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('display_name')->maxLength(160),
                TextInput::make('primary_color')->maxLength(20),
                TextInput::make('timezone')->maxLength(64),
                FileUpload::make('logo_path')
                    ->label('Company logo')
                    ->image()
                    ->disk((string) config('filesystems.training_disk', 'local'))
                    ->directory(fn (): string => 'tenants/'.(string) (tenant('id') ?: 'central').'/branding')
                    ->visibility('private')
                    ->maxSize(2048),
                TextInput::make('sending_domain')->maxLength(190),
                TextInput::make('webhook_url')->url()->maxLength(255),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        if (! FilamentTenant::has()) {
            Notification::make()->title('Select an organization first')->danger()->send();

            return;
        }
        $data = $this->form->getState();
        $existing = DB::table('organization_settings')->first();
        $meta = json_decode((string) ($existing->meta ?? '{}'), true) ?: [];
        $meta['sending_domain'] = $data['sending_domain'] !== '' ? strtolower((string) $data['sending_domain']) : null;
        $meta['webhook_url'] = $data['webhook_url'] !== '' ? $data['webhook_url'] : null;

        $logoPath = $data['logo_path'] ?? null;
        if (is_array($logoPath)) {
            $logoPath = $logoPath[0] ?? null;
        }
        if (filled($existing->logo_path ?? null)
            && filled($logoPath)
            && $existing->logo_path !== $logoPath
            && Storage::disk((string) config('filesystems.training_disk', 'local'))->exists($existing->logo_path)
        ) {
            Storage::disk((string) config('filesystems.training_disk', 'local'))->delete($existing->logo_path);
        }

        unset($data['sending_domain'], $data['webhook_url']);
        $data['logo_path'] = $logoPath ?: ($existing->logo_path ?? null);

        DB::table('organization_settings')->updateOrInsert(
            ['id' => 1],
            $data + [
                'meta' => json_encode($meta, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
                'created_at' => $existing->created_at ?? now(),
            ],
        );
        Notification::make()->title('Settings saved')->success()->send();
    }
}
