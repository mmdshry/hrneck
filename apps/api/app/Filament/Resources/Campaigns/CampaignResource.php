<?php

namespace App\Filament\Resources\Campaigns;

use App\Domains\Campaigns\Actions\LaunchTrainingCampaign;
use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Campaigns\Pages\ManageCampaigns;
use App\Filament\Support\AuditsFilamentMutation;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CampaignResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = Campaign::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-paper-airplane';

    protected static ?string $navigationLabel = 'Campaigns';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 11;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required()->maxLength(160),
            Select::make('course_id')
                ->label('Course')
                ->options(fn () => Course::query()->orderBy('title')->pluck('title', 'id'))
                ->required(),
            Select::make('target_ids')
                ->label('Targets')
                ->multiple()
                ->options(fn () => Target::query()->orderBy('email')->limit(500)->pluck('email', 'id')),
            Select::make('group_ids')
                ->label('Groups')
                ->multiple()
                ->options(fn () => Group::query()->orderBy('name')->pluck('name', 'id')),
            Toggle::make('launch_now')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')->searchable(),
                TextColumn::make('type')->badge(),
                TextColumn::make('status')->badge(),
                TextColumn::make('course.title')->label('Course'),
                TextColumn::make('recipients_count')->counts('recipients')->label('Recipients'),
                TextColumn::make('starts_at')->dateTime(),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([
                ViewAction::make(),
                Action::make('launch')
                    ->label('Launch')
                    ->icon('heroicon-o-play')
                    ->visible(fn (Campaign $record): bool => in_array($record->status, ['draft', 'scheduled'], true))
                    ->form([
                        Select::make('target_ids')
                            ->label('Targets')
                            ->multiple()
                            ->options(fn () => Target::query()->orderBy('email')->limit(500)->pluck('email', 'id')),
                        Select::make('group_ids')
                            ->label('Groups')
                            ->multiple()
                            ->options(fn () => Group::query()->orderBy('name')->pluck('name', 'id')),
                    ])
                    ->action(function (Campaign $record, array $data): void {
                        $ids = app(ResolveCampaignAudience::class)->handle(
                            $data['target_ids'] ?? [],
                            $data['group_ids'] ?? [],
                        );
                        app(LaunchTrainingCampaign::class)->handle($record, $ids);
                        AuditsFilamentMutation::log('campaigns', 'launched', 'Campaign launched', $record, [
                            'name' => $record->name,
                        ]);
                    }),
                DeleteAction::make()
                    ->before(function (Campaign $record): void {
                        AuditsFilamentMutation::log('campaigns', 'deleted', 'Campaign deleted', null, [
                            'campaign' => $record->only(['id', 'name', 'status']),
                        ]);
                    }),
            ]);
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->with(['course']);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageCampaigns::route('/'),
        ];
    }
}
