<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Jobs\SendTrainingReminderJob;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\Notifications\Actions\CreateUserNotification;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Notifications\Support\ResolveUsersFromTargets;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Enrollment;

class LaunchTrainingCampaign
{
    /**
     * @param  list<int>  $targetIds
     * @param  list<int>  $groupIds  Groups the campaign was sent to, in request order.
     */
    public function handle(Campaign $campaign, array $targetIds, array $groupIds = []): Campaign
    {
        $groupIds = array_values(array_filter(
            array_map(intval(...), $groupIds),
            fn (int $id): bool => $id > 0,
        ));

        $targets = Target::query()->with('groups')->whereIn('id', $targetIds)->get();
        $courseId = (int) $campaign->course_id;
        $campaign->loadMissing('course');
        $courseTitle = (string) ($campaign->course?->title ?? 'Training');

        foreach ($targets as $target) {
            $enrollment = Enrollment::query()->firstOrCreate(
                [
                    'course_id' => $courseId,
                    'target_id' => $target->id,
                ],
                [
                    'status' => 'assigned',
                    'progress' => 0,
                    'opened_at' => null,
                ],
            );

            $recipient = CampaignRecipient::query()->create([
                'campaign_id' => $campaign->id,
                'target_id' => $target->id,
                'status' => 'pending',
            ]);

            $group = $this->attributeGroup($target, $groupIds);
            $assignment = TrainingAssignment::query()->firstOrCreate(
                [
                    'campaign_id' => $campaign->id,
                    'course_id' => $courseId > 0 ? $courseId : null,
                    'target_id' => $target->id,
                    'group_id' => $group['id'],
                ],
                [
                    'campaign_name' => (string) $campaign->name,
                    'course_title' => $courseTitle,
                    'target_name' => $this->targetName($target),
                    'target_email' => (string) $target->email,
                    'group_name' => $group['name'],
                    'enrollment_id' => $enrollment->id,
                    'recipient_id' => $recipient->id,
                    'is_remedial' => (bool) $campaign->is_remedial,
                    'status' => 'no_action',
                ],
            );

            SendTrainingReminderJob::dispatch($recipient->id, $enrollment->id, $assignment->id);
        }

        $campaign->forceFill([
            'status' => 'running',
            'starts_at' => $campaign->starts_at ?? now(),
        ])->save();

        $userIds = app(ResolveUsersFromTargets::class)->handle($targetIds);
        $notify = app(CreateUserNotification::class);
        foreach ($userIds as $userId) {
            $notify->handle(
                $userId,
                UserNotification::TYPE_TRAINING_ASSIGNED,
                'Training assigned',
                $courseTitle,
                [
                    'link' => '/learn',
                    'entity_id' => $courseId,
                    'course_id' => $courseId,
                    'campaign_id' => $campaign->id,
                ],
            );
        }

        PublishLive::metricsBundle();

        return $campaign->fresh(['recipients', 'course']) ?? $campaign;
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
