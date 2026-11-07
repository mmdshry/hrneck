<?php

namespace App\Filament\Widgets;

use App\Models\Tenant;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class RecentTenants extends TableWidget
{
    protected static ?string $heading = 'Recent organizations';

    protected int|string|array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(Tenant::query()->latest()->limit(10))
            ->columns([
                TextColumn::make('id')->label('Slug'),
                TextColumn::make('name'),
                TextColumn::make('status')->badge(),
                TextColumn::make('created_at')->dateTime(),
            ])
            ->paginated(false);
    }
}
