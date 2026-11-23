<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\AnalyticsReporting\Models\ReportArchive;

class BuildExportCalendar
{
    /**
     * @return array{year: int, months: list<array{key: string, label: string, available: bool}>, quarters: list<array{key: string, label: string, available: bool}>}
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

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $key = $monthKeys[$m - 1];
            $months[] = [
                'key' => $key,
                'label' => date('F', mktime(0, 0, 0, $m, 1)),
                'available' => isset($readyMonthlySet[$key]) || $m < $nowMonth || $year < $nowYear,
            ];
        }

        $quarters = [];
        foreach ([1, 2, 3, 4] as $q) {
            $key = $quarterKeys[$q - 1];
            $quarters[] = [
                'key' => $key,
                'label' => 'Q'.$q,
                'available' => isset($existingSet[$key]) || $q <= $currentQuarter || $year < $nowYear,
            ];
        }

        return [
            'year' => $year,
            'months' => $months,
            'quarters' => $quarters,
        ];
    }
}
