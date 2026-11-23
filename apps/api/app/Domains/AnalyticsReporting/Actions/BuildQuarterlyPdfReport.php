<?php

namespace App\Domains\AnalyticsReporting\Actions;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BuildQuarterlyPdfReport
{
    public function __construct(
        private readonly BuildBusinessReportMetrics $businessMetrics,
        private readonly BuildTargetReportMetrics $targetMetrics,
    ) {}

    /**
     * @param  array{
     *   include_training?: bool,
     *   timezone?: string,
     *   period_type?: string,
     *   mode?: string,
     *   target_id?: int|null,
     *   group_id?: int|null,
     *   target_ids?: list<int>
     * }  $options
     * @return array{path: string, absolute: string, metrics: array<string, mixed>}
     */
    public function handle(string $periodKey, string $scope = 'business', array $options = []): array
    {
        $safePeriodKey = preg_replace('/[^0-9A-Za-z\-]/', '', $periodKey) ?? '';
        if ($safePeriodKey === '' || ! preg_match('/^\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])$/', $safePeriodKey)) {
            throw new \InvalidArgumentException('Invalid report period key.');
        }

        $includeTraining = $options['include_training'] ?? true;
        $timezone = $options['timezone'] ?? null;
        if (! is_string($timezone) || trim($timezone) === '') {
            $stored = DB::table('organization_settings')->value('timezone');
            $timezone = is_string($stored) && $stored !== '' ? $stored : 'UTC';
        }

        if ($scope === 'user') {
            $report = $this->targetMetrics->handle($safePeriodKey, $timezone, [
                'mode' => $options['mode'] ?? 'single',
                'target_id' => $options['target_id'] ?? null,
                'group_id' => $options['group_id'] ?? null,
                'target_ids' => $options['target_ids'] ?? [],
                'include_training' => (bool) $includeTraining,
            ]);
            $html = view('reports.target', ['report' => $report])->render();
            $suffix = ($options['mode'] ?? 'single') === 'list'
                ? 'list'
                : (string) ($options['target_id'] ?? 'employee');
            $suffix = preg_replace('/[^0-9A-Za-z\-]/', '', $suffix) ?: 'employee';
            $relative = 'reports/'.(tenant('id') ?: 'central').'/'.$safePeriodKey.'-user-'.$suffix.'.pdf';
        } else {
            $report = $this->businessMetrics->handle($safePeriodKey, $timezone, (bool) $includeTraining);
            $html = view('reports.quarterly', ['report' => $report])->render();
            $relative = 'reports/'.(tenant('id') ?: 'central').'/'.$safePeriodKey.'-'.$scope.'.pdf';
        }

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');
        Storage::disk('local')->put($relative, $pdf->output());

        return [
            'path' => $relative,
            'absolute' => Storage::disk('local')->path($relative),
            'metrics' => $report,
        ];
    }
}
