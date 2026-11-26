<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Jobs\SendTrainingReminderJob;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Notifications\Actions\CreateUserNotification;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Notifications\Support\ResolveUsersFromTargets;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Target;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

class LaunchTrainingCampaign
{
    public function __construct(private CreateTrainingAssignments $assignments) {}

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

        $courses = $campaign->courses()->get();
        if ($courses->isEmpty()) {
            throw ValidationException::withMessages([
                'course_ids' => ['Add at least one course to this campaign before launching it.'],
            ]);
        }
        $courseLabel = $courses->pluck('title')->implode(', ');

        $targets = Target::query()->with('groups')->whereIn('id', $targetIds)->get();

        foreach ($targets as $target) {
            // One recipient per learner: a single reminder covers every course in the campaign.
            $recipient = CampaignRecipient::query()->create([
                'campaign_id' => $campaign->id,
                'target_id' => $target->id,
                'status' => 'pending',
            ]);

            $this->assignments->handle($campaign, $courses, $target, $groupIds, $recipient);

            SendTrainingReminderJob::dispatch($recipient->id);
        }

        $campaign->forceFill([
            'status' => 'running',
            'starts_at' => $this->effectiveStartsAt($campaign),
        ])->save();

        $courseIds = $courses->pluck('id')->map(intval(...))->all();
        $userIds = app(ResolveUsersFromTargets::class)->handle($targetIds);
        $notify = app(CreateUserNotification::class);
        foreach ($userIds as $userId) {
            $notify->handle(
                $userId,
                UserNotification::TYPE_TRAINING_ASSIGNED,
                'Training assigned',
                $courseLabel,
                [
                    'link' => '/portal',
                    'entity_id' => $courseIds[0],
                    'course_id' => $courseIds[0],
                    'course_ids' => $courseIds,
                    'campaign_id' => $campaign->id,
                ],
            );
        }

        PublishLive::metricsBundle();

        return $campaign->fresh(['recipients', 'courses']) ?? $campaign;
    }

    /**
     * A launch before the scheduled start (for example a manual launch from Filament) starts the campaign now.
     */
    private function effectiveStartsAt(Campaign $campaign): CarbonInterface
    {
        $startsAt = $campaign->starts_at;

        return $startsAt === null || $startsAt->isFuture() ? now() : $startsAt;
    }
}
