<?php

namespace App\Filament\Resources\ReportSchedules;

use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\ReportSchedules\Pages\ManageReportSchedules;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ReportScheduleResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = ReportSchedule::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-calendar-days';

    protected static ?string $navigationLabel = 'Report schedules';

    protected static string|\UnitEnum|null $navigationGroup = 'Reporting';

    protected static ?int $navigationSort = 30;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required(),
            Select::make('cadence')->options([
                'weekly' => 'weekly',
                'monthly' => 'monthly',
                'quarterly' => 'quarterly',
            ])->required(),
            Select::make('format')->options([
                'csv' => 'csv',
                'pdf' => 'pdf',
            ])->default('pdf'),
            TextInput::make('recipient_email')->email()->required(),
            DateTimePicker::make('next_run_at'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name'),
                TextColumn::make('cadence')->badge(),
                TextColumn::make('format'),
                TextColumn::make('recipient_email'),
                TextColumn::make('next_run_at')->dateTime(),
                TextColumn::make('last_run_at')->dateTime(),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageReportSchedules::route('/'),
        ];
    }
}
