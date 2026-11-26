<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use Illuminate\Support\Collection;

/**
 * Creates one learner's enrollments and per-course assignment rows for a campaign.
 *
 * A scheduled campaign calls this when it is scheduled, so the learner sees the training
 * (locked until the start). The launch calls it again and attaches the campaign recipient
 * to the rows created earlier.
 */
class CreateTrainingAssignments
{
    /**
     * @param  Collection<int, Course>  $courses
     * @param  list<int>  $groupIds  Groups the campaign was sent to, in request order.
     */
    public function handle(
        Campaign $campaign,
        Collection $courses,
        Target $target,
        array $groupIds,
        ?CampaignRecipient $recipient = null,
    ): void {
        $group = $this->attributeGroup($target, $groupIds);

        foreach ($courses as $course) {
            $enrollment = Enrollment::query()->firstOrCreate(
                [
                    'course_id' => $course->id,
                    'target_id' => $target->id,
                ],
                [
                    'status' => 'assigned',
                    'progress' => 0,
                    'opened_at' => null,
                ],
            );

            $assignment = TrainingAssignment::query()->firstOrCreate(
                [
                    'campaign_id' => $campaign->id,
                    'course_id' => $course->id,
                    'target_id' => $target->id,
                    'group_id' => $group['id'],
                ],
                [
                    'campaign_name' => (string) $campaign->name,
                    'course_title' => (string) $course->title,
                    'target_name' => $this->targetName($target),
                    'target_email' => (string) $target->email,
                    'group_name' => $group['name'],
                    'enrollment_id' => $enrollment->id,
                    'recipient_id' => $recipient?->id,
                    'is_remedial' => (bool) $campaign->is_remedial,
                    'status' => 'no_action',
                ],
            );

            if ($recipient !== null && $assignment->recipient_id === null) {
                $assignment->forceFill(['recipient_id' => $recipient->id])->save();
            }
        }
    }

    /**
     * The group the send is attributed to: the first requested group the
     * person belonged to, otherwise their first group, otherwise Direct.
     *
     * @param  list<int>  $groupIds
     * @return array{id: int|null, name: string}
     */
    private function attributeGroup(Target $target, array $groupIds): array
    {
        $memberships = $target->groups->keyBy(fn (Group $group): int => (int) $group->id);

        foreach ($groupIds as $groupId) {
            $group = $memberships->get($groupId);
            if ($group instanceof Group) {
                return ['id' => (int) $group->id, 'name' => (string) $group->name];
            }
        }

        $fallback = $target->groups->sortBy('name')->first();
        if ($fallback instanceof Group) {
            return ['id' => (int) $fallback->id, 'name' => (string) $fallback->name];
        }

        return ['id' => null, 'name' => 'Direct'];
    }

    private function targetName(Target $target): string
    {
        $name = trim(((string) $target->first_name).' '.((string) $target->last_name));

        return $name !== '' ? $name : (string) $target->email;
    }
}
