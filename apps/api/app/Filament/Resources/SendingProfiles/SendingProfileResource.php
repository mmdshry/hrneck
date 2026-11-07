<?php

namespace App\Filament\Resources\SendingProfiles;

use App\Domains\MailDelivery\Models\SendingProfile;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\SendingProfiles\Pages\ManageSendingProfiles;
use App\Filament\Support\AuditsFilamentMutation;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class SendingProfileResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = SendingProfile::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-at-symbol';

    protected static ?string $navigationLabel = 'Sending profiles';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant settings';

    protected static ?int $navigationSort = 21;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required(),
            TextInput::make('from_name')->required(),
            TextInput::make('from_email')->email()->required(),
            TextInput::make('mailer')->default('smtp'),
            Toggle::make('is_default')->default(false),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name'),
                TextColumn::make('from_name'),
                TextColumn::make('from_email'),
                TextColumn::make('mailer'),
                IconColumn::make('is_default')->boolean(),
            ])
            ->recordActions([
                EditAction::make()
                    ->after(function (SendingProfile $record): void {
                        if ($record->is_default) {
                            SendingProfile::query()->whereKeyNot($record->id)->update(['is_default' => false]);
                        }
                        AuditsFilamentMutation::log(
                            'settings',
                            'sending_profile_updated',
                            'Sending profile updated',
                            $record,
                            ['name' => $record->name],
                        );
                    }),
                DeleteAction::make()
                    ->before(function (SendingProfile $record): void {
                        AuditsFilamentMutation::log(
                            'settings',
                            'sending_profile_deleted',
                            'Sending profile deleted',
                            null,
                            ['profile' => $record->only(['id', 'name', 'from_email'])],
                        );
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageSendingProfiles::route('/'),
        ];
    }
}
