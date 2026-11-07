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
use App\Domains\TrainingLms\Models\Enrollment;
use Illuminate\Support\Str;

class LaunchTrainingCampaign
{
    /**
     * @param  list<int>  $targetIds
     */
    public function handle(Campaign $campaign, array $targetIds): Campaign
    {
        $targets = Target::query()->whereIn('id', $targetIds)->get();
        $courseId = (int) $campaign->course_id;
        $tenantPrefix = (string) (tenant('id') ?: 'central');

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
                'tracking_token' => $tenantPrefix.'.train.'.Str::random(32),
                'status' => 'pending',
            ]);

            SendTrainingReminderJob::dispatch($recipient->id, $enrollment->id);
        }

        $campaign->forceFill([
            'status' => 'running',
            'starts_at' => now(),
        ])->save();

        $campaign->loadMissing('course');
        $courseTitle = (string) ($campaign->course?->title ?? $campaign->name ?? 'Training');
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
}
