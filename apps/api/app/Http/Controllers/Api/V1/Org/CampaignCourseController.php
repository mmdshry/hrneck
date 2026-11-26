<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Campaigns\Actions\SyncCampaignCourses;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TrainingLms\Models\Course;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CampaignCourseController extends Controller
{
    public function store(
        Request $request,
        Campaign $campaign,
        SyncCampaignCourses $sync,
        LogOrgActivity $audit,
    ): JsonResponse {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
        ]);
        $sync->assertEditable($campaign);

        $courseId = (int) $data['course_id'];
        $courseIds = $this->currentCourseIds($campaign);
        if (! in_array($courseId, $courseIds, true)) {
            $courseIds[] = $courseId;
        }

        $campaign = $sync->handle($campaign, $courseIds);

        $audit->handle('campaigns', 'course_added', 'Course added to campaign', $campaign, [
            'course_id' => $courseId,
        ]);
        PublishLive::metricsBundle();

        return response()->json(['data' => $campaign->load(['recipients', 'courses'])]);
    }

    public function destroy(
        Campaign $campaign,
        Course $course,
        SyncCampaignCourses $sync,
        LogOrgActivity $audit,
    ): JsonResponse {
        $sync->assertEditable($campaign);

        $courseIds = array_values(array_filter(
            $this->currentCourseIds($campaign),
            fn (int $id): bool => $id !== (int) $course->id,
        ));
        $campaign = $sync->handle($campaign, $courseIds);

        $audit->handle('campaigns', 'course_removed', 'Course removed from campaign', $campaign, [
            'course_id' => (int) $course->id,
        ]);
        PublishLive::metricsBundle();

        return response()->json(['data' => $campaign->load(['recipients', 'courses'])]);
    }

    /**
     * Saves a new order for the campaign's existing courses. The list must contain exactly the
     * courses already attached, so this endpoint only reorders and never adds or removes.
     */
    public function reorder(
        Request $request,
        Campaign $campaign,
        SyncCampaignCourses $sync,
        LogOrgActivity $audit,
    ): JsonResponse {
        $data = $request->validate([
            'course_ids' => ['required', 'array'],
            'course_ids.*' => ['integer'],
        ]);
        $sync->assertEditable($campaign);

        $requested = array_map(intval(...), $data['course_ids']);
        $current = $this->currentCourseIds($campaign);
        $sameSet = count($requested) === count(array_unique($requested))
            && collect($requested)->sort()->values()->all() === collect($current)->sort()->values()->all();

        if (! $sameSet) {
            throw ValidationException::withMessages([
                'course_ids' => ['The order must list exactly the courses already in this campaign.'],
            ]);
        }

        $campaign = $sync->handle($campaign, $requested);

        $audit->handle('campaigns', 'courses_reordered', 'Campaign courses reordered', $campaign, [
            'course_ids' => $requested,
        ]);
        PublishLive::metricsBundle();

        return response()->json(['data' => $campaign->load(['recipients', 'courses'])]);
    }

    /**
     * @return list<int>
     */
    private function currentCourseIds(Campaign $campaign): array
    {
        return $campaign->courses()
            ->pluck('courses.id')
            ->map(fn ($id): int => (int) $id)
            ->values()
            ->all();
    }
}
