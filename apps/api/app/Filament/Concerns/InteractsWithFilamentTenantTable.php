<?php

namespace App\Filament\Concerns;

use App\Support\FilamentTenant;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Contracts\Pagination\Paginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Avoid querying tenant tables on the central connection when no org is selected.
 */
trait InteractsWithFilamentTenantTable
{
    protected function paginateTableQuery(Builder $query): Paginator|CursorPaginator
    {
        if (! FilamentTenant::has()) {
            $perPage = $this->getTableRecordsPerPage();
            $perPage = ($perPage === 'all' || ! is_numeric($perPage)) ? 10 : (int) $perPage;

            return new LengthAwarePaginator(
                items: [],
                total: 0,
                perPage: max(1, $perPage),
                currentPage: 1,
                options: [
                    'path' => request()->url(),
                    'pageName' => $this->getTablePaginationPageName(),
                ],
            );
        }

        return parent::paginateTableQuery($query);
    }
}
