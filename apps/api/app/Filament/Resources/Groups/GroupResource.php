<?php

namespace App\Filament\Resources\Groups;

use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Groups\Pages\ManageGroups;
use App\Filament\Support\AuditsFilamentMutation;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class GroupResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = Group::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-rectangle-group';

    protected static ?string $navigationLabel = 'Groups';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 13;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required()->maxLength(120),
            TextInput::make('source')->default('manual')->maxLength(40),
            Select::make('targets')
                ->label('Members')
                ->multiple()
                ->relationship('targets', 'email')
                ->preload()
                ->options(fn () => Target::query()->orderBy('email')->limit(500)->pluck('email', 'id')),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')->searchable(),
                TextColumn::make('source'),
                TextColumn::make('targets_count')->counts('targets')->label('Members'),
            ])
            ->recordActions([
                EditAction::make()
                    ->after(function (Group $record): void {
                        AuditsFilamentMutation::log('groups', 'updated', 'Group updated', $record, [
                            'name' => $record->name,
                        ]);
                    }),
                DeleteAction::make()
                    ->before(function (Group $record): void {
                        AuditsFilamentMutation::log('groups', 'deleted', 'Group deleted', null, [
                            'group' => ['id' => $record->id, 'name' => $record->name],
                        ]);
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageGroups::route('/'),
        ];
    }
}
