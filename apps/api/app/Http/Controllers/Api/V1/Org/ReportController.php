<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\AnalyticsReporting\Actions\BuildOrgDetailedReport;
use App\Domains\AnalyticsReporting\Jobs\SendScheduledReportJob;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function summary(Request $request, BuildCampaignReport $report): JsonResponse
    {
        $filters = $this->sharedFilters($request);

        return response()->json([
            'data' => $report->handle(
                null,
                $filters['department_id'],
                $filters['from'],
                $filters['to'],
            ),
        ]);
    }

    public function detailed(Request $request, BuildOrgDetailedReport $report): JsonResponse
    {
        return response()->json(['data' => $report->overview($this->sharedFilters($request))]);
    }

    public function detailedSection(Request $request, string $section, BuildOrgDetailedReport $report): JsonResponse
    {
        try {
            $filters = $this->sectionFilters($request);
            $page = max(1, (int) $request->input('page', 1));
            $perPage = min(100, max(1, (int) $request->input('per_page', 5)));

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
     * @return array{department_id: int|null, from: Carbon|null, to: Carbon|null}
     */
    private function sharedFilters(Request $request): array
    {
        $from = $request->input('from');
        $to = $request->input('to');

        return [
            'department_id' => $request->filled('department_id') ? (int) $request->input('department_id') : null,
            'from' => is_string($from) && $from !== '' ? Carbon::parse($from)->startOfDay() : null,
            'to' => is_string($to) && $to !== '' ? Carbon::parse($to)->endOfDay() : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sectionFilters(Request $request): array
    {
        $shared = $this->sharedFilters($request);

        return array_filter([
            'department_id' => $shared['department_id'],
            'from' => $shared['from'],
            'to' => $shared['to'],
            'q' => $request->input('q'),
            'department' => $request->input('department'),
            'group_id' => $request->input('group_id'),
            'status' => $request->input('status'),
            'type' => $request->input('type'),
            'campaign_id' => $request->input('campaign_id'),
            'course_id' => $request->input('course_id'),
            'category' => $request->input('category'),
            'desk_id' => $request->input('desk_id'),
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'roles' => $request->input('roles'),
            'mfa' => $request->input('mfa'),
            'groups' => $request->input('groups'),
            'risk' => $request->input('risk'),
            'campaign' => $request->input('campaign'),
            'course' => $request->input('course'),
            'progress' => $request->input('progress'),
            'source' => $request->input('source'),
            'title' => $request->input('title'),
            'template' => $request->input('template'),
            'assignee' => $request->input('assignee'),
            'number' => $request->input('number'),
            'summary' => $request->input('summary'),
            'desk' => $request->input('desk'),
            'stage' => $request->input('stage'),
            'priority' => $request->input('priority'),
            'sla' => $request->input('sla'),
        ], static fn ($value) => $value !== null && $value !== '');
    }
}
