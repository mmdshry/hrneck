<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\Campaign;
use Illuminate\Validation\ValidationException;

class SyncCampaignCourses
{
    /** Campaign statuses whose course list may still change. Running or closed campaigns are locked. */
    public const EDITABLE_STATUSES = ['draft', 'scheduled'];

    /**
     * Replace the campaign's ordered course list. A course's position in $courseIds becomes its sort_order.
     *
     * @param  list<int>  $courseIds
     */
    public function handle(Campaign $campaign, array $courseIds): Campaign
    {
        $this->assertEditable($campaign);

        $payload = [];
        $ids = array_map(intval(...), $courseIds);
        foreach (array_values(array_unique(array_filter($ids, fn (int $id): bool => $id > 0))) as $position => $courseId) {
            $payload[$courseId] = ['sort_order' => $position];
        }

        $campaign->courses()->sync($payload);

        return $campaign->fresh(['courses']) ?? $campaign;
    }

    public function assertEditable(Campaign $campaign): void
    {
        if (! in_array($campaign->status, self::EDITABLE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['Courses can only be changed while the campaign is draft or scheduled.'],
            ]);
        }
    }
}
