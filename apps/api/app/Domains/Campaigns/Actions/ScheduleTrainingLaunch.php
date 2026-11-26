<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Validation\ValidationException;

class ScheduleTrainingLaunch
{
    public function __construct(private CreateTrainingAssignments $assignments) {}

    /**
     * Holds a training campaign until its start time. The audience is stored on the campaign so the
     * scheduler can launch it later, and each learner gets their enrollment now so the training shows
     * as locked until it starts.
     *
     * @param  list<int>  $targetIds
     * @param  list<int>  $groupIds
     */
    public function handle(Campaign $campaign, array $targetIds, array $groupIds): Campaign
    {
        $groupIds = array_map(intval(...), $groupIds);

        $courses = $campaign->courses()->get();
        if ($courses->isEmpty()) {
            throw ValidationException::withMessages([
                'course_ids' => ['Add at least one course to this campaign before scheduling it.'],
            ]);
        }

        $campaign->forceFill([
            'status' => 'scheduled',
            'launch_audience' => [
                'target_ids' => array_map(intval(...), $targetIds),
                'group_ids' => $groupIds,
            ],
        ])->save();

        $targets = Target::query()->with('groups')->whereIn('id', $targetIds)->get();
        foreach ($targets as $target) {
            $this->assignments->handle($campaign, $courses, $target, $groupIds);
        }

        return $campaign;
    }
}
