<?php

namespace App\Domains\TargetsGroups\Support;

use Illuminate\Validation\ValidationException;

final class TargetCsvParser
{
    public const MAX_BYTES = 5_242_880; // 5 MB

    public const MAX_ROWS = 5_000;

    public const SAMPLE_ROWS = 5;

    /**
     * @return array{
     *   headers: list<string>,
     *   rows: list<array<string, string>>,
     *   row_count: int
     * }
     */
    public function parse(string $absolutePath): array
    {
        if (! is_file($absolutePath)) {
            throw ValidationException::withMessages([
                'file' => ['Import file is missing or expired.'],
            ]);
        }

        $size = filesize($absolutePath);
        if ($size === false || $size > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                'file' => ['CSV must be 5 MB or smaller.'],
            ]);
        }

        $handle = fopen($absolutePath, 'r');
        if ($handle === false) {
            throw ValidationException::withMessages([
                'file' => ['Unable to read CSV file.'],
            ]);
        }

        try {
            $rawHeader = fgetcsv($handle);
            if ($rawHeader === false || $rawHeader === [null] || $rawHeader === []) {
                throw ValidationException::withMessages([
                    'file' => ['CSV must include a header row.'],
                ]);
            }

            $headers = $this->normalizeHeaderRow($rawHeader);
            if ($headers === []) {
                throw ValidationException::withMessages([
                    'file' => ['CSV must include a header row.'],
                ]);
            }

            $rows = [];
            $rowCount = 0;
            while (($raw = fgetcsv($handle)) !== false) {
                if ($this->isEmptyRow($raw)) {
                    continue;
                }
                $rowCount++;
                if ($rowCount > self::MAX_ROWS) {
                    throw ValidationException::withMessages([
                        'file' => ['CSV may contain at most '.self::MAX_ROWS.' data rows.'],
                    ]);
                }
                $rows[] = $this->combineRow($headers, $raw);
            }

            return [
                'headers' => $headers,
                'rows' => $rows,
                'row_count' => $rowCount,
            ];
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  list<string>  $headers
     * @param  array<string, string|null>  $columnMap
     * @param  array<string, string>  $rawRow
     * @return array<string, string>
     */
    public function applyColumnMap(array $headers, array $columnMap, array $rawRow): array
    {
        $item = [];
        foreach (TargetProfileFields::CSV_HEADERS as $field) {
            $csvHeader = $columnMap[$field] ?? null;
            if ($csvHeader === null || $csvHeader === '') {
                continue;
            }
            if (! in_array($csvHeader, $headers, true)) {
                continue;
            }
            $item[$field] = (string) ($rawRow[$csvHeader] ?? '');
        }

        return $item;
    }

    /**
     * @param  array<string, string|null>  $columnMap
     * @return array<string, string|null>
     */
    public function sanitizeColumnMap(array $columnMap): array
    {
        $clean = [];
        foreach (TargetProfileFields::CSV_HEADERS as $field) {
            $value = $columnMap[$field] ?? null;
            if ($value === null || $value === '') {
                $clean[$field] = null;

                continue;
            }
            $clean[$field] = (string) $value;
        }

        return $clean;
    }

    /**
     * @param  array<int, mixed>  $rawHeader
     * @return list<string>
     */
    private function normalizeHeaderRow(array $rawHeader): array
    {
        $headers = [];
        $seen = [];
        foreach ($rawHeader as $index => $cell) {
            $value = trim((string) $cell);
            if ($index === 0) {
                $value = preg_replace('/^\xEF\xBB\xBF/', '', $value) ?? $value;
            }
            if ($value === '') {
                $value = 'column_'.($index + 1);
            }
            if (isset($seen[$value])) {
                $seen[$value]++;
                $value = $value.'_'.$seen[$value];
            } else {
                $seen[$value] = 1;
            }
            $headers[] = $value;
        }

        return $headers;
    }

    /**
     * @param  list<string>  $headers
     * @param  array<int, mixed>  $raw
     * @return array<string, string>
     */
    private function combineRow(array $headers, array $raw): array
    {
        $row = [];
        foreach ($headers as $index => $header) {
            $row[$header] = isset($raw[$index]) ? trim((string) $raw[$index]) : '';
        }

        return $row;
    }

    /**
     * @param  array<int, mixed>  $raw
     */
    private function isEmptyRow(array $raw): bool
    {
        foreach ($raw as $cell) {
            if (trim((string) $cell) !== '') {
                return false;
            }
        }

        return true;
    }
}
