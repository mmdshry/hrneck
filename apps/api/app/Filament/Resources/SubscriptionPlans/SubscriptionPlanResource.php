<?php

namespace App\Filament\Resources\SubscriptionPlans;

use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Subscriptions\Actions\SaveSubscriptionPlan;
use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Support\PlanFeature;
use App\Filament\Resources\SubscriptionPlans\Pages\ManageSubscriptionPlans;
use App\Filament\Support\AuditsFilamentMutation;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class SubscriptionPlanResource extends Resource
{
    protected static ?string $model = SubscriptionPlan::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-credit-card';

    protected static ?string $navigationLabel = 'Subscription plans';

    protected static string|\UnitEnum|null $navigationGroup = 'Directory';

    protected static ?int $navigationSort = 3;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Plan')
                ->schema([
                    TextInput::make('name')->required()->maxLength(120),
                    TextInput::make('slug')
                        ->required()
                        ->alphaDash()
                        ->maxLength(64)
                        ->unique(ignoreRecord: true),
                    TextInput::make('sort_order')->integer()->minValue(0)->default(0),
                    Toggle::make('is_active')->label('Active')->default(true),
                    Toggle::make('is_default')
                        ->label('Default plan')
                        ->helperText('Applied to organizations that have no subscription record. Only one plan can be the default.')
                        ->default(false),
                ])
                ->columns(2),
            Section::make('Limits')
                ->description('Leave a limit empty to allow unlimited.')
                ->schema([
                    TextInput::make('max_employees')->label('Max employees')->integer()->minValue(0),
                    TextInput::make('max_users')->label('Max users')->integer()->minValue(0),
                ])
                ->columns(2),
            Section::make('Pricing')
                ->description('Informational only. No payment gateway is connected.')
                ->schema([
                    TextInput::make('monthly_price')->label('Monthly price')->numeric()->minValue(0),
                    TextInput::make('currency')->maxLength(3),
                ])
                ->columns(2),
            Section::make('Features')
                ->description('Disabled features are blocked by the API for organizations on this plan.')
                ->schema(array_map(
                    fn (PlanFeature $feature): Toggle => Toggle::make('features.'.$feature->value)
                        ->label($feature->label())
                        ->default(false),
                    PlanFeature::cases(),
                ))
                ->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->columns([
                TextColumn::make('sort_order')->label('Order')->sortable(),
                TextColumn::make('name')->searchable()->sortable(),
                TextColumn::make('slug')->searchable()->toggleable(),
                TextColumn::make('max_employees')->label('Employees')->placeholder('Unlimited')->sortable(),
                TextColumn::make('max_users')->label('Users')->placeholder('Unlimited')->sortable(),
                TextColumn::make('features')
                    ->label('Features')
                    ->getStateUsing(fn (SubscriptionPlan $record): string => sprintf(
                        '%d of %d',
                        count(array_filter($record->features ?? [])),
                        count(PlanFeature::cases()),
                    )),
                TextColumn::make('monthly_price')->label('Monthly price')->numeric(decimalPlaces: 2)->placeholder('—')->toggleable(),
                TextColumn::make('currency')->placeholder('—')->toggleable(),
                TextColumn::make('subscriptions_count')->label('Organizations')->sortable(),
                IconColumn::make('is_default')->label('Default')->boolean(),
                IconColumn::make('is_active')->label('Active')->boolean(),
            ])
            ->recordActions([
                EditAction::make()
                    ->using(fn (SubscriptionPlan $record, array $data): SubscriptionPlan => static::persistPlan($data, $record)),
                DeleteAction::make()
                    ->visible(fn (SubscriptionPlan $record): bool => ! $record->is_default && ! $record->subscriptions()->exists())
                    ->after(fn (SubscriptionPlan $record) => static::auditPlanChange('plan_deleted', 'Subscription plan deleted', $record)),
            ]);
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount('subscriptions');
    }

    /**
     * Saves a plan from the admin form, audits the change and refreshes platform dashboards.
     *
     * @param  array<string, mixed>  $data
     */
    public static function persistPlan(array $data, ?SubscriptionPlan $plan = null): SubscriptionPlan
    {
        try {
            $saved = app(SaveSubscriptionPlan::class)->handle($data, $plan);
        } catch (ValidationException $e) {
            Notification::make()->danger()->title((string) Arr::first(Arr::flatten($e->errors())))->send();

            throw $e;
        }

        static::auditPlanChange(
            $plan === null ? 'plan_created' : 'plan_updated',
            $plan === null ? 'Subscription plan created' : 'Subscription plan updated',
            $saved,
        );

        return $saved;
    }

    public static function auditPlanChange(string $event, string $description, SubscriptionPlan $plan): void
    {
        AuditsFilamentMutation::log('subscriptions', $event, $description, $plan, [
            'plan_slug' => $plan->slug,
            'max_employees' => $plan->max_employees,
            'max_users' => $plan->max_users,
            'is_default' => $plan->is_default,
            'is_active' => $plan->is_active,
        ]);

        PublishLive::msp();
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageSubscriptionPlans::route('/'),
        ];
    }
}
