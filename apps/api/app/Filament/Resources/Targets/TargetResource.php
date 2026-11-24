<?php

namespace App\Filament\Resources\Targets;

use App\Domains\TargetsGroups\Actions\RecalculateTargetRisk;
use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Targets\Pages\ManageTargets;
use App\Filament\Support\AuditsFilamentMutation;
use App\Support\AppLocale;
use App\Support\MajorCities;
use App\Support\TimezoneOptions;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class TargetResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = Target::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationLabel = 'Employees';

    protected static ?string $modelLabel = 'Employee';

    protected static ?string $pluralModelLabel = 'Employees';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 12;

    public static function form(Schema $schema): Schema
    {
        $localeOptions = [];
        foreach (AppLocale::ALLOWED as $code) {
            $localeOptions[$code] = match ($code) {
                'en' => 'English',
                'es' => 'Español',
                'fr' => 'Français',
                'pt' => 'Português',
                'de' => 'Deutsch',
                'ru' => 'Русский',
            };
        }

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
            TextInput::make('job_title')->maxLength(120),
            Select::make('manager_target_id')
                ->label('Manager')
                ->searchable()
                ->options(fn (): array => Target::query()
                    ->orderBy('email')
                    ->limit(500)
                    ->pluck('email', 'id')
                    ->all())
                ->nullable(),
            DatePicker::make('hire_date'),
            TextInput::make('employee_number')->maxLength(120)->unique(ignoreRecord: true),
            TextInput::make('phone')->maxLength(40),
            Select::make('location')
                ->options(fn (): array => MajorCities::options())
                ->getOptionLabelUsing(fn (?string $value): ?string => $value)
                ->searchable()
                ->nullable(),
            Select::make('employment_type')->options([
                'full_time' => 'Full time',
                'part_time' => 'Part time',
                'contractor' => 'Contractor',
                'intern' => 'Intern',
            ])->nullable(),
            Select::make('preferred_language')
                ->options($localeOptions)
                ->nullable(),
            Select::make('timezone')
                ->options(TimezoneOptions::all())
                ->searchable()
                ->required()
                ->default('UTC'),
            Select::make('status')->options([
                'active' => 'active',
                'inactive' => 'inactive',
            ])->default('active'),
            TextInput::make('risk_score')->numeric()->disabled()->dehydrated(false),
            TextInput::make('risk_tier')->disabled()->dehydrated(false),
            TextInput::make('external_id')->maxLength(120),
            FileUpload::make('avatar_path')
                ->label('Photo')
                ->image()
                ->disk((string) config('filesystems.training_disk', 'local'))
                ->directory(fn (): string => 'tenants/'.(string) (tenant('id') ?: 'central').'/avatars')
                ->visibility('private')
                ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                ->maxSize(2048),
            Toggle::make('notification_opt_out')->default(false),
            TextInput::make('user_id')->numeric()->disabled()->dehydrated(false),
            TextInput::make('joined_via')->disabled()->dehydrated(false),
            TextInput::make('risk_source')->disabled()->dehydrated(false),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                ImageColumn::make('avatar_path')
                    ->label('Photo')
                    ->disk((string) config('filesystems.training_disk', 'local'))
                    ->circular()
                    ->defaultImageUrl(null),
                TextColumn::make('email')->searchable(),
                TextColumn::make('first_name')->searchable(),
                TextColumn::make('last_name')->searchable(),
                TextColumn::make('job_title')->toggleable(),
                TextColumn::make('department'),
                TextColumn::make('employment_type')->toggleable(),
                TextColumn::make('status')->badge(),
                TextColumn::make('risk_score')->sortable(),
                TextColumn::make('risk_tier')->badge()->toggleable(),
                TextColumn::make('employee_number')->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('external_id')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->recordActions([
                EditAction::make()
                    ->mutateFormDataUsing(function (array $data): array {
                        unset($data['risk_score'], $data['risk_tier'], $data['risk_source'], $data['risk_updated_at']);

                        if (array_key_exists('preferred_language', $data)) {
                            $raw = $data['preferred_language'];
                            if ($raw === null || (is_string($raw) && trim($raw) === '')) {
                                $data['preferred_language'] = null;
                            } else {
                                $data['preferred_language'] = AppLocale::normalize(is_string($raw) ? $raw : null);
                            }
                        }

                        return $data;
                    })
                    ->after(function (Target $record): void {
                        app(RecalculateTargetRisk::class)->handle($record, force: true);
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
