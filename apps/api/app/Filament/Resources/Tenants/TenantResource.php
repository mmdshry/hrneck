<?php

namespace App\Filament\Resources\Tenants;

use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Tenancy\Actions\DeprovisionLoadTestTenant;
use App\Filament\Resources\Tenants\Pages\ManageTenants;
use App\Models\Tenant;
use App\Support\FilamentTenant;
use App\Support\LoadTestMarkers;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class TenantResource extends Resource
{
    protected static ?string $model = Tenant::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-building-office-2';

    protected static ?string $navigationLabel = 'Organizations';

    protected static string|\UnitEnum|null $navigationGroup = 'Directory';

    protected static ?int $navigationSort = 1;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('id')
                ->label('Slug')
                ->required()
                ->unique(ignoreRecord: true)
                ->alphaDash()
                ->maxLength(63)
                ->disabled(fn (?Tenant $record): bool => $record !== null)
                ->dehydrated(fn (?Tenant $record): bool => $record === null),
            TextInput::make('name')
                ->required()
                ->maxLength(160),
            TextInput::make('industry')
                ->maxLength(120),
            Select::make('employee_band')
                ->options([
                    '1-10' => '1-10',
                    '11-50' => '11-50',
                    '51-200' => '51-200',
                    '201-500' => '201-500',
                    '500+' => '500+',
                ])
                ->default('1-10'),
            Select::make('status')
                ->options([
                    'active' => 'Active',
                    'inactive' => 'Inactive',
                ])
                ->default('active')
                ->required(),
            Toggle::make('training_enabled')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->label('Slug')->searchable()->sortable(),
                TextColumn::make('name')->searchable()->sortable(),
                TextColumn::make('industry')->toggleable(),
                TextColumn::make('employee_band')->label('Employees')->toggleable(),
                TextColumn::make('status')->badge(),
                IconColumn::make('training_enabled')->boolean()->label('Train'),
                TextColumn::make('domains.domain')
                    ->label('Domains')
                    ->listWithLineBreaks()
                    ->limitList(2)
                    ->toggleable(),
                TextColumn::make('created_at')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->recordActions([
                ViewAction::make(),
                EditAction::make()
                    ->after(fn () => PublishLive::msp()),
                Action::make('manageFilament')
                    ->label('Manage in Filament')
                    ->icon('heroicon-o-building-library')
                    ->action(function (Tenant $record): void {
                        FilamentTenant::set($record->id);
                        redirect()->to('/admin');
                    }),
                Action::make('openNext')
                    ->label('Open in Next')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (Tenant $record): string => rtrim((string) config('brand.frontend_url'), '/').'/org?tenant='.$record->id)
                    ->openUrlInNewTab(),
                DeleteAction::make()
                    ->visible(fn (Tenant $record): bool => LoadTestMarkers::isLoadTestTenantId($record->id))
                    ->using(function (Tenant $record): void {
                        app(DeprovisionLoadTestTenant::class)->handle($record);
                    }),
            ])
            ->toolbarActions([]);
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        /** @var \Illuminate\Database\Eloquent\Builder<Tenant> $query */
        $query = parent::getEloquentQuery();

        return $query->with('domains');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageTenants::route('/'),
        ];
    }
}
