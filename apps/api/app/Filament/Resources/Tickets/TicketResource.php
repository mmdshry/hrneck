<?php

namespace App\Filament\Resources\Tickets;

use App\Domains\Ticketing\Models\SdTicket;
use App\Filament\Concerns\RequiresFilamentTenant;
use App\Filament\Resources\Tickets\Pages\ManageTickets;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Resources\Resource;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class TicketResource extends Resource
{
    use RequiresFilamentTenant;

    protected static ?string $model = SdTicket::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-ticket';

    protected static ?string $navigationLabel = 'Tickets';

    protected static string|\UnitEnum|null $navigationGroup = 'Tenant ops';

    protected static ?int $navigationSort = 18;

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['desk', 'stage', 'priority'])->latest())
            ->columns([
                TextColumn::make('number')->searchable()->sortable(),
                TextColumn::make('summary')->searchable()->limit(40),
                TextColumn::make('desk.name')->label('Desk'),
                TextColumn::make('stage.name')->label('Stage'),
                TextColumn::make('priority.name')->label('Priority'),
                IconColumn::make('sla_resolve_breached')->boolean()->label('SLA'),
                TextColumn::make('archived_at')->dateTime()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->recordActions([
                ViewAction::make(),
                Action::make('unlock')
                    ->label('Unlock')
                    ->icon('heroicon-o-lock-open')
                    ->action(function (SdTicket $record): void {
                        $record->update(['locked_by' => null, 'locked_at' => null]);
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageTickets::route('/'),
        ];
    }
}
