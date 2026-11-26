<?php

namespace App\Filament\Resources\ReportSchedules;

use App\Domains\AnalyticsReporting\Actions\ResolveReportRecipients;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\ReportSchedules\Pages\ManageReportSchedules;
use App\Models\User;
use App\Support\FilamentTenant;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

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
            Select::make('recipient_user_ids')
                ->label('Recipients')
                ->multiple()
                ->required()
                ->options(fn (): array => static::recipientOptions()),
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
                TextColumn::make('recipients')
                    ->label('Recipients')
                    ->getStateUsing(fn (ReportSchedule $record): string => User::query()
                        ->whereIn('id', $record->recipientUserIds())
                        ->pluck('email')
                        ->implode(', ')),
                TextColumn::make('next_run_at')->dateTime(),
                TextColumn::make('last_run_at')->dateTime(),
            ])
            ->recordActions([
                EditAction::make()
                    ->mutateRecordDataUsing(fn (array $data, ReportSchedule $record): array => $data + [
                        'recipient_user_ids' => $record->recipientUserIds(),
                    ])
                    ->using(fn (ReportSchedule $record, array $data): ReportSchedule => static::persist($record, $data)),
                DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageReportSchedules::route('/'),
        ];
    }

    /**
     * Members of the selected organization who may view reports.
     *
     * @return array<int, string>
     */
    public static function recipientOptions(): array
    {
        $tenantId = FilamentTenant::id();
        if ($tenantId === null) {
            return [];
        }

        return app(ResolveReportRecipients::class)
            ->handle($tenantId)
            ->mapWithKeys(fn (User $user): array => [(int) $user->id => $user->name.' <'.$user->email.'>'])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function persist(?ReportSchedule $record, array $data): ReportSchedule
    {
        $recipients = app(ResolveReportRecipients::class)->requireEligible(
            (string) FilamentTenant::id(),
            $data['recipient_user_ids'] ?? [],
        );

        return DB::transaction(function () use ($record, $data, $recipients): ReportSchedule {
            $schedule = $record ?? new ReportSchedule;
            $schedule->fill(Arr::except($data, ['recipient_user_ids']))->save();
            $schedule->syncRecipientUserIds($recipients->pluck('id')->all());

            return $schedule;
        });
    }
}
