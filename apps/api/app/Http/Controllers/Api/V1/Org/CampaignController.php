<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Campaigns\Actions\LaunchTrainingCampaign;
use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Campaign::query()->with(['course', 'recipients'])->latest();
        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        } else {
            $query->where('type', 'training');
        }

        $rows = $query->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $type = $request->input('type', 'training');
        $campaigns = Campaign::query()->where('type', $type)->with('recipients')->get();
        $recipients = $campaigns->flatMap->recipients;
        $total = max(1, $recipients->count());

        $courseIds = $campaigns->pluck('course_id')->filter()->unique()->values();
        $enrollments = $courseIds->isEmpty()
            ? collect()
            : Enrollment::query()->whereIn('course_id', $courseIds)->get();
        $enrollmentTotal = max(1, $enrollments->count());
        $openedFromEnrollment = $enrollments->whereNotNull('opened_at')->count();
        $completedFromEnrollment = $enrollments->where('status', 'completed')->count();
        $openedRecipients = $recipients->filter(
            fn ($r) => $r->opened_at !== null || $r->status === 'completed' || $r->status === 'opened'
        )->count();
        $completedRecipients = $recipients->where('status', 'completed')->count();

        $openedCount = max($openedFromEnrollment, $openedRecipients);
        $completedCount = max($completedFromEnrollment, $completedRecipients);
        $metricTotal = max($enrollmentTotal, $total);

        return response()->json([
            'data' => [
                'campaigns_total' => $campaigns->count(),
                'completed' => $campaigns->where('status', 'completed')->count(),
                'running' => $campaigns->where('status', 'running')->count(),
                'scheduled' => $campaigns->where('status', 'scheduled')->count(),
                'enrollments_total' => $enrollments->count(),
                'enrollments_completed' => $completedFromEnrollment,
                'enrollments_in_progress' => $enrollments->where('status', 'in_progress')->count(),
                'no_action_pct' => round((($metricTotal - $openedCount) / $metricTotal) * 100, 1),
                'opened_pct' => round(($openedCount / $metricTotal) * 100, 1),
                'completed_pct' => round(($completedCount / $metricTotal) * 100, 1),
            ],
        ]);
    }

    public function store(
        Request $request,
        LaunchTrainingCampaign $train,
        ResolveCampaignAudience $audience,
        LogOrgActivity $audit,
    ): JsonResponse {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'type' => ['sometimes', 'in:training'],
            'course_id' => ['nullable', 'integer'],
            'target_ids' => ['required_without:group_ids', 'array'],
            'target_ids.*' => ['integer'],
            'group_ids' => ['required_without:target_ids', 'array'],
            'group_ids.*' => ['integer'],
            'scheduled_at' => ['nullable', 'date'],
            'launch' => ['sometimes', 'boolean'],
        ]);

        $targetIds = $audience->handle($data['target_ids'] ?? [], $data['group_ids'] ?? []);

        $status = ! empty($data['scheduled_at']) && ! $request->boolean('launch', true)
            ? 'scheduled'
            : 'draft';

        $campaign = Campaign::query()->create([
            'name' => $data['name'],
            'type' => 'training',
            'status' => $status,
            'course_id' => $data['course_id'] ?? Course::query()->value('id'),
            'scheduled_at' => $data['scheduled_at'] ?? null,
            'randomize_send' => false,
        ]);

        if ($request->boolean('launch', true)) {
            $campaign = $train->handle($campaign, $targetIds);
        } else {
            PublishLive::metricsBundle();
        }

        $audit->handle('campaigns', 'created', 'Campaign created', $campaign, [
            'name' => $campaign->name,
            'status' => $campaign->status,
        ]);

        return response()->json(['data' => $campaign->load(['recipients', 'course'])], 201);
    }

    public function update(Request $request, Campaign $campaign, LogOrgActivity $audit): JsonResponse
    {
        if (in_array($campaign->status, ['completed', 'cancelled', 'archived'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Completed, cancelled, or archived campaigns cannot be edited.'],
            ]);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'scheduled_at' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'string', 'in:draft,scheduled,running,cancelled,archived'],
        ]);

        if (isset($data['status']) && $data['status'] === 'running' && ! in_array($campaign->status, ['draft', 'scheduled', 'running'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Cannot set status to running from the current state.'],
            ]);
        }

        $before = $campaign->only(['name', 'scheduled_at', 'status']);
        $campaign->fill($data)->save();

        $event = match ($campaign->status) {
            'cancelled' => 'cancelled',
            'archived' => 'archived',
            default => 'updated',
        };

        $audit->handle('campaigns', $event, 'Campaign '.$event, $campaign, [
            'before' => $before,
            'after' => $campaign->only(['name', 'scheduled_at', 'status']),
        ]);

        PublishLive::metricsBundle();

        return response()->json(['data' => $campaign->load(['recipients', 'course'])]);
    }

    public function destroy(Campaign $campaign, LogOrgActivity $audit): JsonResponse
    {
        if (in_array($campaign->status, ['running', 'completed'], true)) {
            $campaign->status = 'archived';
            $campaign->save();

            $audit->handle('campaigns', 'archived', 'Campaign archived', $campaign, [
                'name' => $campaign->name,
            ]);

            PublishLive::metricsBundle();

            return response()->json(['data' => $campaign->fresh(['recipients', 'course'])]);
        }

        $snapshot = ['id' => $campaign->id, 'name' => $campaign->name, 'status' => $campaign->status];
        $campaign->recipients()->delete();
        $campaign->delete();

        $audit->handle('campaigns', 'deleted', 'Campaign deleted', null, [
            'campaign' => $snapshot,
        ]);

        PublishLive::metricsBundle();

        return response()->json(['message' => 'Deleted']);
    }
}
