<?php

namespace App\Filament\Resources\ReportArchives;

use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\ReportArchives\Pages\ManageReportArchives;
use App\Support\FilamentTenant;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Storage;

class ReportArchiveResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = ReportArchive::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-document-arrow-down';

    protected static ?string $navigationLabel = 'Report archives';

    protected static string|\UnitEnum|null $navigationGroup = 'Reporting';

    protected static ?int $navigationSort = 31;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name'),
                TextColumn::make('scope')->badge(),
                TextColumn::make('period_type'),
                TextColumn::make('period_key'),
                TextColumn::make('format'),
                TextColumn::make('status')->badge(),
                TextColumn::make('generated_at')->dateTime(),
            ])
            ->defaultSort('id', 'desc')
            ->headerActions([
                Action::make('generate')
                    ->label('Generate PDF')
                    ->icon('heroicon-o-plus')
                    ->visible(fn (): bool => FilamentTenant::has())
                    ->form([
                        Select::make('scope')->options([
                            'business' => 'business',
                            'user' => 'user',
                        ])->default('business')->required(),
                        Select::make('period_type')->options([
                            'monthly' => 'monthly',
                            'quarterly' => 'quarterly',
                            'custom' => 'custom',
                        ])->default('quarterly')->required(),
                        TextInput::make('period_key')->required()->placeholder('2026-Q3'),
                        TextInput::make('timezone')->default('UTC'),
                        Toggle::make('include_training')->default(true),
                    ])
                    ->action(function (array $data): void {
                        $result = app(BuildQuarterlyPdfReport::class)->handle(
                            $data['period_key'],
                            $data['scope'],
                            [
                                'timezone' => $data['timezone'] ?? 'UTC',
                                'include_training' => (bool) ($data['include_training'] ?? true),
                            ],
                        );
                        ReportArchive::query()->create([
                            'name' => strtoupper($data['scope']).' '.$data['period_key'],
                            'scope' => $data['scope'],
                            'period_type' => $data['period_type'],
                            'period_key' => $data['period_key'],
                            'format' => 'pdf',
                            'disk_path' => $result['path'],
                            'timezone' => $data['timezone'] ?? 'UTC',
                            'options' => [
                                'include_training' => (bool) ($data['include_training'] ?? true),
                            ],
                            'status' => 'ready',
                            'generated_at' => now(),
                        ]);
                        Notification::make()->title('PDF generated')->success()->send();
                    }),
            ])
            ->recordActions([
                Action::make('download')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->action(function (ReportArchive $record) {
                        return Storage::disk('local')->download(
                            $record->disk_path,
                            $record->period_key.'-'.$record->scope.'.pdf',
                        );
                    }),
                DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageReportArchives::route('/'),
        ];
    }
}
