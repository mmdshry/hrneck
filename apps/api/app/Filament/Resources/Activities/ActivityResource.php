<?php

namespace App\Filament\Resources\Activities;

use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Activities\Pages\ManageActivities;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Models\Activity;

class ActivityResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = Activity::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-clipboard-document-list';

    protected static ?string $navigationLabel = 'Activity log';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 5;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('log_name')->disabled(),
            TextInput::make('event')->disabled(),
            TextInput::make('description')->disabled()->columnSpanFull(),
            Textarea::make('properties')
                ->formatStateUsing(fn ($state): string => is_array($state) || is_object($state)
                    ? json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '{}'
                    : (string) $state)
                ->disabled()
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('created_at')->dateTime()->sortable()->label('When'),
                TextColumn::make('log_name')->badge()->searchable()->label('Domain'),
                TextColumn::make('event')->badge()->searchable(),
                TextColumn::make('description')->wrap()->limit(80)->searchable(),
                TextColumn::make('causer_label')
                    ->label('Causer')
                    ->state(function (Activity $record): string {
                        $props = $record->properties?->toArray() ?? [];
                        if (! empty($props['causer_email'])) {
                            return (string) $props['causer_email'];
                        }

                        return $record->causer_id
                            ? '#'.$record->causer_id
                            : 'system';
                    }),
                TextColumn::make('subject_type')
                    ->label('Subject')
                    ->formatStateUsing(function (?string $state, Activity $record): string {
                        if ($state === null) {
                            return '—';
                        }

                        $short = class_basename($state);

                        return $short.($record->subject_id ? ' #'.$record->subject_id : '');
                    }),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('log_name')
                    ->label('Domain')
                    ->options(fn (): array => Activity::query()
                        ->whereNotNull('log_name')
                        ->distinct()
                        ->orderBy('log_name')
                        ->pluck('log_name', 'log_name')
                        ->all()),
                SelectFilter::make('event')
                    ->options(fn (): array => Activity::query()
                        ->whereNotNull('event')
                        ->distinct()
                        ->orderBy('event')
                        ->pluck('event', 'event')
                        ->all()),
            ])
            ->recordActions([])
            ->toolbarActions([]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageActivities::route('/'),
        ];
    }
}
