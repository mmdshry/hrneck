<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class BuildQuarterlyPdfReport
{
    /**
     * @param  array{include_training?: bool, timezone?: string}  $options
     * @return array{path: string, absolute: string, metrics: array<string, mixed>}
     */
    public function handle(string $periodKey, string $scope = 'business', array $options = []): array
    {
        $includeTraining = $options['include_training'] ?? true;
        $timezone = $options['timezone'] ?? 'UTC';

        $enrollments = Enrollment::query()->with('course')->get();
        $assigned = max(1, $enrollments->count());
        $completed = $enrollments->where('status', 'completed')->count();
        $inProgress = $enrollments->where('status', 'in_progress')->count();
        $passed = $enrollments->where('progress', '>=', 70)->count();
        $failed = $enrollments->where('status', 'failed')->count();
        $trainNoAction = $enrollments->whereNull('opened_at')->where('progress', 0)->count();

        $courseRisk = Course::query()->get()->map(function (Course $course) use ($enrollments) {
            $rows = $enrollments->where('course_id', $course->id);
            $count = max(1, $rows->count());

            return [
                'course' => $course->title,
                'users' => $rows->count(),
                'incomplete' => $rows->where('status', '!=', 'completed')->count(),
                'failed' => $rows->where('status', 'failed')->count(),
                'completion_rate' => round(($rows->where('status', 'completed')->count() / $count) * 100, 1),
            ];
        })->sortBy('completion_rate')->values()->all();

        $metrics = [
            'period_key' => $periodKey,
            'scope' => $scope,
            'timezone' => $timezone,
            'brand' => config('brand.name'),
            'tenant' => tenant('id'),
            'training' => $includeTraining ? [
                'campaigns' => Campaign::query()->where('type', 'training')->count(),
                'assigned' => $enrollments->count(),
                'no_action_pct' => round(($trainNoAction / $assigned) * 100, 1),
                'incomplete_pct' => round(($inProgress / $assigned) * 100, 1),
                'failed_pct' => round(($failed / $assigned) * 100, 1),
                'passed_pct' => round(($passed / $assigned) * 100, 1),
                'completed_pct' => round(($completed / $assigned) * 100, 1),
                'courses_by_risk' => $courseRisk,
            ] : null,
            'generated_at' => now($timezone)->toIso8601String(),
        ];

        $html = view('reports.quarterly', ['m' => $metrics])->render();
        $pdf = Pdf::loadHTML($html)->setPaper('a4');
        $relative = 'reports/'.(tenant('id') ?: 'central').'/'.$periodKey.'-'.$scope.'.pdf';
        Storage::disk('local')->put($relative, $pdf->output());

        return [
            'path' => $relative,
            'absolute' => Storage::disk('local')->path($relative),
            'metrics' => $metrics,
        ];
    }
}
