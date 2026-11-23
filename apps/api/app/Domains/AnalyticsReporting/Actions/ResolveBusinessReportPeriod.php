<?php

namespace App\Domains\AnalyticsReporting\Actions;

use DateTimeZone;
use Exception;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

class ResolveBusinessReportPeriod
{
    /**
     * Weekly schedules have no separate template; they use the previous closed month.
     *
     * @return array{type: string, key: string}
     */
    public function closed(string $cadence, string $timezone, ?Carbon $now = null): array
    {
        $timezone = $this->timezone($timezone);
        $now = ($now ?? now($timezone))->copy()->timezone($timezone);

        if ($cadence === 'quarterly') {
            $anchor = $now->copy()->startOfQuarter()->subDay();
            $quarter = (int) ceil($anchor->month / 3);

            return [
                'type' => 'quarterly',
                'key' => sprintf('%04d-Q%d', $anchor->year, $quarter),
            ];
        }

        if ($cadence === 'monthly' || $cadence === 'weekly') {
            $anchor = $now->copy()->startOfMonth()->subDay();

            return [
                'type' => 'monthly',
                'key' => $anchor->format('Y-m'),
            ];
        }

        throw new InvalidArgumentException("Unsupported report cadence [{$cadence}].");
    }

    /**
     * @return array{
     *   type: string,
     *   key: string,
     *   timezone: string,
     *   start: Carbon,
     *   end: Carbon,
     *   previous_start: Carbon,
     *   previous_end: Carbon,
     *   label: string,
     *   current_months: list<array{label: string, start: Carbon, end: Carbon}>,
     *   previous_months: list<array{label: string, start: Carbon, end: Carbon}>
     * }
     */
    public function parse(string $periodKey, string $timezone): array
    {
        $timezone = $this->timezone($timezone);

        if (preg_match('/^(\d{4})-Q([1-4])$/', $periodKey, $matches) === 1) {
            $year = (int) $matches[1];
            $quarter = (int) $matches[2];
            $start = Carbon::create($year, (($quarter - 1) * 3) + 1, 1, 0, 0, 0, $timezone);
            if (! $start instanceof Carbon) {
                throw new InvalidArgumentException("Unrecognized report period [{$periodKey}].");
            }
            $start = $start->startOfMonth();
            $end = $start->copy()->addMonths(2)->endOfMonth();
            $previousStart = $start->copy()->subMonths(3)->startOfMonth();
            $previousEnd = $start->copy()->subMonth()->endOfMonth();

            return $this->pack('quarterly', $periodKey, $timezone, $start, $end, $previousStart, $previousEnd);
        }

        if (preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $periodKey, $matches) === 1) {
            $start = Carbon::create((int) $matches[1], (int) $matches[2], 1, 0, 0, 0, $timezone);
            if (! $start instanceof Carbon) {
                throw new InvalidArgumentException("Unrecognized report period [{$periodKey}].");
            }
            $start = $start->startOfMonth();
            $end = $start->copy()->endOfMonth();
            $previousStart = $start->copy()->subMonth()->startOfMonth();
            $previousEnd = $previousStart->copy()->endOfMonth();

            return $this->pack('monthly', $periodKey, $timezone, $start, $end, $previousStart, $previousEnd);
        }

        throw new InvalidArgumentException("Unrecognized report period [{$periodKey}].");
    }

    /**
     * @return array{
     *   type: string,
     *   key: string,
     *   timezone: string,
     *   start: Carbon,
     *   end: Carbon,
     *   previous_start: Carbon,
     *   previous_end: Carbon,
     *   label: string,
     *   current_months: list<array{label: string, start: Carbon, end: Carbon}>,
     *   previous_months: list<array{label: string, start: Carbon, end: Carbon}>
     * }
     */
    private function pack(
        string $type,
        string $key,
        string $timezone,
        Carbon $start,
        Carbon $end,
        Carbon $previousStart,
        Carbon $previousEnd,
    ): array {
        $span = $type === 'quarterly' ? 3 : 1;

        return [
            'type' => $type,
            'key' => $key,
            'timezone' => $timezone,
            'start' => $start,
            'end' => $end,
            'previous_start' => $previousStart,
            'previous_end' => $previousEnd,
            'label' => $start->format('m/d/Y').' - '.$end->format('m/d/Y'),
            'current_months' => $this->months($start, $span),
            'previous_months' => $this->months($previousStart, $span),
        ];
    }

    /**
     * @return list<array{label: string, start: Carbon, end: Carbon}>
     */
    private function months(Carbon $start, int $count): array
    {
        $months = [];
        for ($i = 0; $i < $count; $i++) {
            $monthStart = $start->copy()->addMonths($i)->startOfMonth();
            $months[] = [
                'label' => $monthStart->format('M'),
                'start' => $monthStart,
                'end' => $monthStart->copy()->endOfMonth(),
            ];
        }

        return $months;
    }

    private function timezone(string $timezone): string
    {
        $timezone = trim($timezone);
        if ($timezone === '') {
            return 'UTC';
        }

        try {
            new DateTimeZone($timezone);
        } catch (Exception) {
            return 'UTC';
        }

        return $timezone;
    }
}
