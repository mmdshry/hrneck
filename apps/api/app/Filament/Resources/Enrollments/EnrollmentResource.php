<?php

namespace App\Filament\Resources\Enrollments;

use App\Domains\TrainingLms\Models\Enrollment;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Enrollments\Pages\ManageEnrollments;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class EnrollmentResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = Enrollment::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-clipboard-document-check';

    protected static ?string $navigationLabel = 'Enrollments';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 15;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('course_id')->relationship('course', 'title')->required(),
            Select::make('target_id')->relationship('target', 'email')->required()->searchable(),
            Select::make('status')->options([
                'assigned' => 'assigned',
                'in_progress' => 'in_progress',
                'completed' => 'completed',
                'failed' => 'failed',
            ])->default('assigned'),
            TextInput::make('progress')->numeric()->minValue(0)->maxValue(100)->default(0),
            Select::make('source')->options([
                'manual' => 'manual',
                'campaign' => 'campaign',
            ])->default('manual'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('course.title'),
                TextColumn::make('target.email'),
                TextColumn::make('status')->badge(),
                TextColumn::make('progress'),
                TextColumn::make('source'),
            ])
            ->filters([
                SelectFilter::make('status')->options([
                    'assigned' => 'assigned',
                    'in_progress' => 'in_progress',
                    'completed' => 'completed',
                    'failed' => 'failed',
                ]),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageEnrollments::route('/'),
        ];
    }
}
