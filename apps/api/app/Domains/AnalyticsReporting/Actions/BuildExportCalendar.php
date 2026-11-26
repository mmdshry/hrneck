<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\AnalyticsReporting\Models\ReportArchive;
use Illuminate\Support\Facades\Storage;

class BuildExportCalendar
{
    /**
     * @return array{year: int, months: list<array{key: string, label: string, available: bool, archive_id: int|null}>, quarters: list<array{key: string, label: string, available: bool, archive_id: int|null}>}
     */
    public function handle(?int $year = null): array
    {
        $year ??= (int) now()->year;
        $nowMonth = (int) now()->month;
        $nowYear = (int) now()->year;
        $currentQuarter = (int) ceil($nowMonth / 3);

        $monthKeys = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthKeys[] = sprintf('%04d-%02d', $year, $m);
        }
        $quarterKeys = [];
        foreach ([1, 2, 3, 4] as $q) {
            $quarterKeys[] = sprintf('%04d-Q%d', $year, $q);
        }

        $readyMonthly = ReportArchive::query()
            ->where('period_type', 'monthly')
            ->where('status', 'ready')
            ->whereIn('period_key', $monthKeys)
            ->pluck('period_key')
            ->all();
        $readyMonthlySet = array_fill_keys($readyMonthly, true);

        $existingPeriods = ReportArchive::query()
            ->whereIn('period_key', array_merge($monthKeys, $quarterKeys))
            ->pluck('period_key')
            ->all();
        $existingSet = array_fill_keys($existingPeriods, true);

        $archiveIds = $this->businessArchiveIds(array_merge($monthKeys, $quarterKeys));

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $key = $monthKeys[$m - 1];
            $months[] = [
                'key' => $key,
                'label' => date('F', mktime(0, 0, 0, $m, 1)),
                'available' => isset($readyMonthlySet[$key]) || $m < $nowMonth || $year < $nowYear,
                'archive_id' => $archiveIds[$key] ?? null,
            ];
        }

        $quarters = [];
        foreach ([1, 2, 3, 4] as $q) {
            $key = $quarterKeys[$q - 1];
            $quarters[] = [
                'key' => $key,
                'label' => 'Q'.$q,
                'available' => isset($existingSet[$key]) || $q <= $currentQuarter || $year < $nowYear,
                'archive_id' => $archiveIds[$key] ?? null,
            ];
        }

        return [
            'year' => $year,
            'months' => $months,
            'quarters' => $quarters,
        ];
    }

    /**
     * Newest ready business archive per period whose PDF file still exists on disk.
     *
     * @param  list<string>  $periodKeys
     * @return array<string, int>
     */
    private function businessArchiveIds(array $periodKeys): array
    {
        $ids = [];

        $archives = ReportArchive::query()
            ->where('scope', 'business')
            ->where('status', 'ready')
            ->whereIn('period_key', $periodKeys)
            ->orderByDesc('generated_at')
            ->get(['id', 'period_key', 'disk_path']);

        foreach ($archives as $archive) {
            if (isset($ids[$archive->period_key]) || $archive->disk_path === '') {
                continue;
            }
            if (! Storage::disk('local')->exists($archive->disk_path)) {
                continue;
            }
            $ids[$archive->period_key] = (int) $archive->id;
        }

        return $ids;
    }
}
