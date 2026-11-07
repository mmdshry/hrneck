<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

final class ApiPagination
{
    public static function perPage(Request $request, int $default = 25, int $max = 100): int
    {
        return min($max, max(1, (int) $request->input('per_page', $default)));
    }

    /**
     * @return array{current_page: int, last_page: int, per_page: int, total: int}
     */
    public static function meta(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ];
    }
}
