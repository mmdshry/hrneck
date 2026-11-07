<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\AnalyticsReporting\Actions\BuildOrgDetailedReport;
use App\Domains\AnalyticsReporting\Jobs\SendScheduledReportJob;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function summary(BuildCampaignReport $report): JsonResponse
    {
        return response()->json(['data' => $report->handle()]);
    }

    public function detailed(BuildOrgDetailedReport $report): JsonResponse
    {
        return response()->json(['data' => $report->overview()]);
    }

    public function detailedSection(Request $request, string $section, BuildOrgDetailedReport $report): JsonResponse
    {
        try {
            $filters = $this->sectionFilters($request);
            $page = max(1, (int) $request->input('page', 1));
            $perPage = min(100, max(1, (int) $request->input('per_page', 25)));

            return response()->json(['data' => $report->section($section, $filters, $page, $perPage)]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }
    }

    public function detailedSectionCsv(Request $request, string $section, BuildOrgDetailedReport $report): StreamedResponse|JsonResponse
    {
        try {
            return $report->csv($section, $this->sectionFilters($request));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }
    }

    public function email(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);
        SendScheduledReportJob::dispatch($data['email']);

        return response()->json(['queued' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function sectionFilters(Request $request): array
    {
        return array_filter([
            'q' => $request->input('q'),
            'department' => $request->input('department'),
            'group_id' => $request->input('group_id'),
            'status' => $request->input('status'),
            'type' => $request->input('type'),
            'campaign_id' => $request->input('campaign_id'),
            'course_id' => $request->input('course_id'),
            'category' => $request->input('category'),
            'desk_id' => $request->input('desk_id'),
        ], static fn ($value) => $value !== null && $value !== '');
    }
}
