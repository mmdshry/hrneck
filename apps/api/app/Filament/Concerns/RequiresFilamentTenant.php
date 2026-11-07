<?php

namespace App\Filament\Concerns;

use App\Support\FilamentTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

trait RequiresFilamentTenant
{
    public static function canViewAny(): bool
    {
        return true;
    }

    public static function canCreate(): bool
    {
        return FilamentTenant::has();
    }

    public static function canEdit(Model $record): bool
    {
        return FilamentTenant::has();
    }

    public static function canDelete(Model $record): bool
    {
        return FilamentTenant::has();
    }

    public static function getEloquentQuery(): Builder
    {
        $query = parent::getEloquentQuery();

        if (! FilamentTenant::has()) {
            return $query->whereRaw('1 = 0');
        }

        return $query;
    }
}
