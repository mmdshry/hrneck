<?php

namespace App\Filament\Resources\Users;

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Filament\Resources\Users\Pages\ManageUsers;
use App\Models\Tenant;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationLabel = 'Users';

    protected static string|\UnitEnum|null $navigationGroup = 'Directory';

    protected static ?int $navigationSort = 2;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required()->maxLength(120),
            TextInput::make('email')->email()->required()->unique(ignoreRecord: true),
            TextInput::make('password')
                ->password()
                ->revealable()
                ->dehydrated(fn (?string $state): bool => filled($state))
                ->required(fn (string $operation): bool => $operation === 'create'),
            Select::make('tenant_id')
                ->label('Organization')
                ->helperText('Leave empty for platform staff. Set to provision an organization admin.')
                ->options(fn (): array => Tenant::query()->orderBy('name')->pluck('name', 'id')->all())
                ->searchable()
                ->nullable(),
            Select::make('roles')
                ->label('Platform roles')
                ->multiple()
                ->options([
                    OrgPermissionCatalog::PLATFORM_SUPER_ADMIN => 'Platform super admin',
                    OrgPermissionCatalog::PLATFORM_AGENT => 'Platform agent',
                ])
                ->visible(fn (callable $get): bool => blank($get('tenant_id')))
                ->dehydrated(fn (callable $get): bool => blank($get('tenant_id'))),
            Toggle::make('mfa_enabled')->label('MFA enabled')->disabled()->dehydrated(false),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with('roles'))
            ->columns([
                TextColumn::make('name')->searchable()->sortable(),
                TextColumn::make('email')->searchable()->sortable(),
                TextColumn::make('tenant_id')->label('Org')->placeholder('Platform')->badge(),
                TextColumn::make('roles.name')->badge()->label('Roles'),
                IconColumn::make('mfa_enabled')->boolean()->label('MFA'),
                TextColumn::make('created_at')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->recordActions([
                EditAction::make()
                    ->mutateFormDataUsing(function (array $data): array {
                        unset($data['mfa_enabled']);

                        return $data;
                    })
                    ->using(function (User $record, array $data): User {
                        return static::persistUser($record, $data);
                    }),
                DeleteAction::make()
                    ->visible(fn (User $record): bool => $record->email !== config('brand.demo_admin_email')),
            ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function persistUser(?User $record, array $data): User
    {
        $tenantId = $data['tenant_id'] ?? null;
        $password = $data['password'] ?? null;
        $roles = $data['roles'] ?? [];
        unset($data['roles'], $data['password']);

        if (filled($tenantId)) {
            if ($record) {
                throw ValidationException::withMessages([
                    'tenant_id' => ['Convert platform users via org user APIs, or create a new org user.'],
                ]);
            }

            try {
                return app(CreateOrgUser::class)->handle(
                    (string) $tenantId,
                    (string) $data['name'],
                    (string) $data['email'],
                    (string) $password,
                    [OrgPermissionCatalog::ORG_ADMIN],
                );
            } catch (ValidationException $e) {
                Notification::make()->danger()->title($e->getMessage())->send();
                throw $e;
            }
        }

        setPermissionsTeamId(null);

        if ($record) {
            $record->fill($data);
            if (filled($password)) {
                $record->password = Hash::make((string) $password);
            }
            $record->tenant_id = null;
            $record->save();
            $record->syncRoles($roles);

            return $record;
        }

        $user = User::query()->create([
            ...$data,
            'password' => Hash::make((string) $password),
            'tenant_id' => null,
        ]);
        $user->syncRoles($roles !== [] ? $roles : [OrgPermissionCatalog::PLATFORM_SUPER_ADMIN]);

        return $user;
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageUsers::route('/'),
        ];
    }
}
