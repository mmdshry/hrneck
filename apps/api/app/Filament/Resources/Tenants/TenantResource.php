<?php

namespace App\Filament\Resources\Tenants;

use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Subscriptions\Actions\AssignTenantSubscription;
use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Support\SubscriptionStatus;
use App\Domains\Subscriptions\Support\TenantEntitlements;
use App\Domains\Tenancy\Actions\DeprovisionLoadTestTenant;
use App\Filament\Resources\Tenants\Pages\ManageTenants;
use App\Filament\Support\AuditsFilamentMutation;
use App\Models\Tenant;
use App\Support\FilamentTenant;
use App\Support\LoadTestMarkers;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DateTimePicker;
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
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class TenantResource extends Resource
{
    protected static ?string $model = Tenant::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-building-office-2';

    protected static ?string $navigationLabel = 'Organizations';

    protected static string|\UnitEnum|null $navigationGroup = 'Directory';

    protected static ?int $navigationSort = 1;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('id')
                ->label('Slug')
                ->required()
                ->unique(ignoreRecord: true)
                ->alphaDash()
                ->maxLength(63)
                ->disabled(fn (?Tenant $record): bool => $record !== null)
                ->dehydrated(fn (?Tenant $record): bool => $record === null),
            TextInput::make('name')
                ->required()
                ->maxLength(160),
            TextInput::make('industry')
                ->maxLength(120),
            Select::make('employee_band')
                ->options([
                    '1-10' => '1-10',
                    '11-50' => '11-50',
                    '51-200' => '51-200',
                    '201-500' => '201-500',
                    '500+' => '500+',
                ])
                ->default('1-10'),
            Select::make('status')
                ->options([
                    'active' => 'Active',
                    'inactive' => 'Inactive',
                ])
                ->default('active')
                ->required(),
            Toggle::make('training_enabled')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->label('Slug')->searchable()->sortable(),
                TextColumn::make('name')->searchable()->sortable(),
                TextColumn::make('industry')->toggleable(),
                TextColumn::make('employee_band')->label('Employees')->toggleable(),
                TextColumn::make('status')->badge(),
                IconColumn::make('training_enabled')->boolean()->label('Train'),
                TextColumn::make('plan')
                    ->label('Plan')
                    ->getStateUsing(fn (Tenant $record): string => $record->currentSubscription()?->plan->name ?? 'Default')
                    ->toggleable(),
                TextColumn::make('subscription_status')
                    ->label('Subscription')
                    ->badge()
                    ->getStateUsing(fn (Tenant $record): string => self::subscriptionLabel($record))
                    ->color(fn (Tenant $record): string => self::subscriptionColor($record))
                    ->toggleable(),
                TextColumn::make('domains.domain')
                    ->label('Domains')
                    ->listWithLineBreaks()
                    ->limitList(2)
                    ->toggleable(),
                TextColumn::make('created_at')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->recordActions([
                ViewAction::make(),
                EditAction::make()
                    ->after(fn () => PublishLive::msp()),
                Action::make('changePlan')
                    ->label('Plan & status')
                    ->icon('heroicon-o-credit-card')
                    ->modalHeading(fn (Tenant $record): string => 'Subscription for '.$record->name)
                    ->modalDescription(fn (Tenant $record): string => self::usageSummary($record))
                    ->fillForm(fn (Tenant $record): array => self::subscriptionFormState($record))
                    ->form([
                        Select::make('subscription_plan_id')
                            ->label('Plan')
                            ->options(fn (): array => SubscriptionPlan::query()
                                ->active()
                                ->orderBy('sort_order')
                                ->pluck('name', 'id')
                                ->all())
                            ->required()
                            ->searchable(),
                        Select::make('status')
                            ->options(self::statusOptions())
                            ->required()
                            ->live(),
                        DateTimePicker::make('trial_ends_at')
                            ->label('Trial ends at')
                            ->visible(fn (callable $get): bool => $get('status') === SubscriptionStatus::Trial->value)
                            ->required(fn (callable $get): bool => $get('status') === SubscriptionStatus::Trial->value),
                        DateTimePicker::make('ends_at')
                            ->label('Ends at')
                            ->helperText('Leave empty for no expiry. A past date restricts new employees, users and paid features.'),
                    ])
                    ->action(function (Tenant $record, array $data): void {
                        try {
                            $subscription = app(AssignTenantSubscription::class)->handle($record->id, $data);
                        } catch (ValidationException $e) {
                            Notification::make()->danger()->title((string) Arr::first(Arr::flatten($e->errors())))->send();

                            throw $e;
                        }

                        AuditsFilamentMutation::log(
                            'subscriptions',
                            'tenant_subscription_changed',
                            'Organization subscription changed',
                            $subscription,
                            [
                                'tenant_id' => $record->id,
                                'subscription_plan_id' => $subscription->subscription_plan_id,
                                'status' => $subscription->status->value,
                            ],
                        );

                        PublishLive::msp();
                        Notification::make()->success()->title('Subscription updated')->send();
                    }),
                Action::make('manageFilament')
                    ->label('Manage in Filament')
                    ->icon('heroicon-o-building-library')
                    ->action(function (Tenant $record): void {
                        FilamentTenant::set($record->id);
                        redirect()->to('/admin');
                    }),
                Action::make('openNext')
                    ->label('Open in Next')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (Tenant $record): string => rtrim((string) config('brand.frontend_url'), '/').'/org?tenant='.$record->id)
                    ->openUrlInNewTab(),
                DeleteAction::make()
                    ->visible(fn (Tenant $record): bool => LoadTestMarkers::isLoadTestTenantId($record->id))
                    ->using(function (Tenant $record): void {
                        app(DeprovisionLoadTestTenant::class)->handle($record);
                    }),
            ])
            ->toolbarActions([]);
    }

    public static function getEloquentQuery(): Builder
    {
        /** @var Builder<Tenant> $query */
        $query = parent::getEloquentQuery();

        return $query->with(['domains', 'subscription.plan']);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageTenants::route('/'),
        ];
    }

    private static function subscriptionLabel(Tenant $record): string
    {
        $subscription = $record->currentSubscription();

        if ($subscription === null) {
            return 'Default';
        }

        $effective = $subscription->effectiveStatus(now());

        return $subscription->isReadOnly(now())
            ? $effective->label().' (read-only)'
            : $effective->label();
    }

    private static function subscriptionColor(Tenant $record): string
    {
        return match ($record->currentSubscription()?->effectiveStatus(now())) {
            SubscriptionStatus::Active => 'success',
            SubscriptionStatus::Trial => 'info',
            SubscriptionStatus::Suspended => 'danger',
            SubscriptionStatus::Expired => 'warning',
            null => 'gray',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private static function subscriptionFormState(Tenant $record): array
    {
        $subscription = $record->currentSubscription();
        $subscriptionPlanId = $subscription?->subscription_plan_id;

        return [
            'subscription_plan_id' => $subscriptionPlanId
                ?? SubscriptionPlan::query()->where('is_default', true)->value('id'),
            'status' => $subscription?->status->value ?? SubscriptionStatus::Active->value,
            'trial_ends_at' => $subscription?->trial_ends_at?->format('Y-m-d H:i:s'),
            'ends_at' => $subscription?->ends_at?->format('Y-m-d H:i:s'),
        ];
    }

    private static function usageSummary(Tenant $record): string
    {
        $usage = app(TenantEntitlements::class)->usage($record->id);
        $plan = $record->currentSubscription()?->plan;
        $plan ??= SubscriptionPlan::query()->where('is_default', true)->first();
        $readOnly = $record->currentSubscription()?->isReadOnly(now()) ?? false;

        return implode(' | ', array_filter([
            'Employees: '.self::limitLabel($usage['employees'], $plan?->max_employees),
            'Users: '.self::limitLabel($usage['users'], $plan?->max_users),
            $readOnly ? 'Read-only: the org app blocks all changes until the status is reactivated.' : null,
        ]));
    }

    private static function limitLabel(int $usage, ?int $maximum): string
    {
        return $maximum === null
            ? sprintf('%d (unlimited)', $usage)
            : sprintf('%d / %d', $usage, $maximum);
    }

    /**
     * @return array<string, string>
     */
    private static function statusOptions(): array
    {
        return collect(SubscriptionStatus::cases())
            ->mapWithKeys(fn (SubscriptionStatus $status): array => [$status->value => $status->label()])
            ->all();
    }
}
