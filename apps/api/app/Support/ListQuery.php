<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Whitelisted list filtering helpers for paginated API endpoints.
 *
 * Flat query params: q (global search) + per-column keys + optional sort/order.
 */
final class ListQuery
{
    /**
     * Apply OR-like search across the given columns when `q` is present.
     *
     * @param  list<string>  $columns
     */
    public static function applySearch(Builder $query, Request $request, array $columns, string $param = 'q'): Builder
    {
        $raw = trim((string) $request->input($param, ''));
        if ($raw === '' || $columns === []) {
            return $query;
        }

        $like = self::likePattern($raw);

        return $query->where(function (Builder $builder) use ($columns, $like): void {
            foreach ($columns as $index => $column) {
                if ($index === 0) {
                    self::whereColumnLike($builder, $column, $like);

                    continue;
                }
                $builder->orWhere(function (Builder $inner) use ($column, $like): void {
                    self::whereColumnLike($inner, $column, $like);
                });
            }
        });
    }

    /**
     * Apply LIKE filters for whitelisted request keys mapped to columns.
     *
     * @param  array<string, string>  $map  request key => column (supports relation.column)
     */
    public static function applyLikeFilters(Builder $query, Request $request, array $map): Builder
    {
        foreach ($map as $param => $column) {
            $raw = trim((string) $request->input($param, ''));
            if ($raw === '') {
                continue;
            }
            self::whereColumnLike($query, $column, self::likePattern($raw));
        }

        return $query;
    }

    /**
     * Apply exact-match filters for whitelisted request keys.
     *
     * @param  array<string, string>  $map  request key => column
     */
    public static function applyExactFilters(Builder $query, Request $request, array $map): Builder
    {
        foreach ($map as $param => $column) {
            if (! $request->filled($param)) {
                continue;
            }
            $value = $request->input($param);
            if (is_string($value)) {
                $value = trim($value);
                if ($value === '') {
                    continue;
                }
            }
            if (str_contains($column, '.')) {
                [$relation, $relColumn] = explode('.', $column, 2);
                $query->whereHas($relation, function (Builder $builder) use ($relColumn, $value): void {
                    $builder->where($relColumn, $value);
                });
            } else {
                $query->where($column, $value);
            }
        }

        return $query;
    }

    /**
     * Apply boolean-ish filters (true/false/1/0/yes/no).
     *
     * @param  array<string, string>  $map
     */
    public static function applyBooleanFilters(Builder $query, Request $request, array $map): Builder
    {
        foreach ($map as $param => $column) {
            if (! $request->filled($param)) {
                continue;
            }
            $raw = strtolower(trim((string) $request->input($param)));
            if (in_array($raw, ['1', 'true', 'yes', 'on'], true)) {
                $query->where($column, true);
            } elseif (in_array($raw, ['0', 'false', 'no', 'off'], true)) {
                $query->where($column, false);
            }
        }

        return $query;
    }

    /**
     * Apply whitelist sort: ?sort=column&order=asc|desc
     *
     * @param  array<string, string>  $sortable  request sort id => column
     */
    public static function applySort(Builder $query, Request $request, array $sortable, string $defaultColumn = 'id', string $defaultDirection = 'desc'): Builder
    {
        $sort = trim((string) $request->input('sort', ''));
        $order = strtolower(trim((string) $request->input('order', 'asc')));
        $direction = $order === 'desc' ? 'desc' : 'asc';

        if ($sort !== '' && isset($sortable[$sort])) {
            return $query->orderBy($sortable[$sort], $direction);
        }

        return $query->orderBy($defaultColumn, $defaultDirection);
    }

    public static function likePattern(string $raw): string
    {
        return '%'.str_replace(['%', '_'], ['\\%', '\\_'], $raw).'%';
    }

    private static function whereColumnLike(Builder $builder, string $column, string $like): void
    {
        if (str_contains($column, '.')) {
            [$relation, $relColumn] = explode('.', $column, 2);
            $builder->whereHas($relation, function (Builder $inner) use ($relColumn, $like): void {
                $inner->where($relColumn, 'like', $like);
            });

            return;
        }

        $builder->where($column, 'like', $like);
    }
}
