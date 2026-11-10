<?php

namespace App\Filament\Resources\Targets;

use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Targets\Pages\ManageTargets;
use App\Filament\Support\AuditsFilamentMutation;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class TargetResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = Target::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationLabel = 'Employees';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 12;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('email')->email()->required()->unique(ignoreRecord: true),
            TextInput::make('first_name')->maxLength(120),
            TextInput::make('last_name')->maxLength(120),
            Select::make('department_id')
                ->label('Department')
                ->relationship('departmentRecord', 'name')
                ->searchable()
                ->preload()
                ->nullable(),
            Select::make('status')->options([
                'active' => 'active',
                'inactive' => 'inactive',
            ])->default('active'),
            TextInput::make('risk_score')->numeric()->minValue(0)->maxValue(100)->default(0),
            TextInput::make('external_id')->maxLength(120),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('email')->searchable(),
                TextColumn::make('first_name')->searchable(),
                TextColumn::make('last_name')->searchable(),
                TextColumn::make('department'),
                TextColumn::make('status')->badge(),
                TextColumn::make('risk_score')->sortable(),
            ])
            ->recordActions([
                EditAction::make()
                    ->after(function (Target $record): void {
                        AuditsFilamentMutation::log('targets', 'updated', 'Target updated', $record, [
                            'email' => $record->email,
                            'status' => $record->status,
                        ]);
                    }),
                DeleteAction::make()
                    ->before(function (Target $record): void {
                        AuditsFilamentMutation::log('targets', 'deleted', 'Target deleted', null, [
                            'target' => $record->only(['id', 'email', 'status']),
                        ]);
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageTargets::route('/'),
        ];
    }
}
