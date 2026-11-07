<?php

namespace App\Filament\Resources\Courses;

use App\Domains\TrainingLms\Models\Course;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Courses\Pages\EditCourse;
use App\Filament\Resources\Courses\Pages\ListCourses;
use App\Filament\Resources\Courses\RelationManagers\LessonsRelationManager;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CourseResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = Course::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-academic-cap';

    protected static ?string $navigationLabel = 'Training courses';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 14;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('title')->required()->maxLength(160),
            Textarea::make('description')->rows(3),
            TextInput::make('duration_minutes')->numeric()->default(10),
            Toggle::make('is_sample')->default(false),
            Repeater::make('quiz_questions')
                ->label('Quiz questions (saved to course quiz)')
                ->dehydrated(false)
                ->schema([
                    TextInput::make('prompt')->required(),
                    Textarea::make('options_text')
                        ->label('Options (one per line)')
                        ->required()
                        ->helperText('First option is index 0'),
                    TextInput::make('correct_index')->numeric()->default(0)->required(),
                ])
                ->columnSpanFull()
                ->defaultItems(0),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')->searchable(),
                TextColumn::make('duration_minutes')->label('Minutes'),
                IconColumn::make('is_sample')->boolean(),
                TextColumn::make('lessons_count')->counts('lessons'),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            LessonsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListCourses::route('/'),
            'edit' => EditCourse::route('/{record}/edit'),
        ];
    }
}
