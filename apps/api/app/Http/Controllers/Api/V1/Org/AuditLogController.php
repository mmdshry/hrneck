<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Support\AuditEntityLabels;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

/**
 * Read-only audit trail for the active organization (the tenant's activity_log).
 */
class AuditLogController extends Controller
{
    /**
     * Activity `source` values written by platform staff tooling. They are removed before
     * the entry is returned, so organization users never see which admin surface made a change.
     */
    private const STAFF_SOURCES = ['filament', 'platform_staff'];

    public function index(Request $request, AuditEntityLabels $labels): JsonResponse
    {
        $query = Activity::query();

        if ($request->filled('log')) {
            $query->inLog((string) $request->input('log'));
        }
        if ($request->filled('subject_type')) {
            $query->where('subject_type', (string) $request->input('subject_type'));
        }
        if ($request->filled('causer_id')) {
            $query->where('causer_id', (int) $request->input('causer_id'));
        }

        ListQuery::applySearch($query, $request, ['description', 'event']);
        ListQuery::applyLikeFilters($query, $request, ['event' => 'event']);
        ListQuery::applySort($query, $request, [
            'created_at' => 'created_at',
            'event' => 'event',
        ], 'created_at', 'desc');

        $page = $query->orderByDesc('id')->paginate(ApiPagination::perPage($request));

        $activities = collect($page->items());
        $resolved = $labels->forActivities($activities);

        return response()->json([
            'data' => $activities
                ->map(fn (Activity $activity): array => $this->payload($activity, $resolved[$activity->id]))
                ->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * @param  array{causer: array<string, mixed>|null, subject: array<string, mixed>|null}  $labels
     * @return array<string, mixed>
     */
    private function payload(Activity $activity, array $labels): array
    {
        return [
            'id' => $activity->id,
            'log_name' => $activity->log_name,
            'event' => $activity->event,
            'description' => $activity->description,
            'subject_type' => $activity->subject_type,
            'subject_id' => $activity->subject_id,
            'causer_id' => $activity->causer_id,
            'causer' => $labels['causer'],
            'subject' => $labels['subject'],
            'properties' => $this->customerProperties($activity),
            'created_at' => $activity->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function customerProperties(Activity $activity): array
    {
        $properties = $activity->properties->all();

        if (in_array($properties['source'] ?? null, self::STAFF_SOURCES, true)) {
            unset($properties['source']);
        }

        return $properties;
    }
}
