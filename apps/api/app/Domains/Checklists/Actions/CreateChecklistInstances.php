<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Checklists\Support\ResolveChecklistStaffRecipients;
use App\Domains\Notifications\Actions\CreateUserNotification;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\User;
use App\Support\AppLocale;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateChecklistInstances
{
    public function __construct(
        private ResolveCampaignAudience $audience,
        private LogChecklistActivity $audit,
    ) {}

    /**
     * @param  list<int|string>  $targetIds
     * @param  list<int|string>  $groupIds
     * @return list<ChecklistInstance>
     */
    public function handle(
        ChecklistTemplate $template,
        array $targetIds = [],
        array $groupIds = [],
        ?int $actorId = null,
        bool $requireCreated = true,
    ): array {
        if ($template->is_system) {
            throw ValidationException::withMessages([
                'template_id' => ['Copy a system template before assigning it to employees.'],
            ]);
        }

        if ($template->current_version < 1) {
            throw ValidationException::withMessages([
                'template_id' => ['Template has no published schema version.'],
            ]);
        }

        $version = $template->latestVersion();
        if ($version === null) {
            throw ValidationException::withMessages([
                'template_id' => ['Template version missing.'],
            ]);
        }

        $resolved = array_values(array_unique(array_map('intval', $this->audience->handle($targetIds, $groupIds))));
        $created = [];

        DB::transaction(function () use ($template, $version, $resolved, $actorId, &$created) {
            if ($resolved === []) {
                return;
            }

            $openTargetIds = ChecklistInstance::query()
                ->where('template_id', $template->id)
                ->whereIn('target_id', $resolved)
                ->whereIn('status', [
                    ChecklistInstance::STATUS_NOT_STARTED,
                    ChecklistInstance::STATUS_IN_PROGRESS,
                ])
                ->pluck('target_id')
                ->map(static fn ($id): int => (int) $id)
                ->all();
            $openSet = array_fill_keys($openTargetIds, true);

            $targets = Target::query()
                ->whereIn('id', $resolved)
                ->get()
                ->keyBy(fn (Target $target): int => (int) $target->id);
            $prefill = app(PrefillChecklistInstanceFromTarget::class);

            foreach ($resolved as $targetId) {
                if (isset($openSet[$targetId])) {
                    continue;
                }

                $target = $targets->get($targetId);
                if ($target === null) {
                    continue;
                }

                $instance = ChecklistInstance::query()->create([
                    'template_id' => $template->id,
                    'template_version_id' => $version->id,
                    'target_id' => $targetId,
                    'title' => $template->name,
                    'status' => ChecklistInstance::STATUS_NOT_STARTED,
                    'schema_snapshot' => $version->schema_json,
                    'progress_pct' => 0,
                    'assigned_by' => $actorId,
                ]);

                $this->audit->handle(
                    'instance_created',
                    'Checklist instance created for target',
                    $instance,
                    [
                        'template_id' => $template->id,
                        'target_id' => $targetId,
                        'version' => $version->version,
                    ],
                    $actorId,
                );

                $instance = $prefill->handle($instance, $target);
                $created[] = $instance;
            }
        });

        if ($created === []) {
            if ($requireCreated) {
                throw ValidationException::withMessages([
                    'target_ids' => ['No new instances created. Targets may already have an open checklist for this template.'],
                ]);
            }

            return [];
        }

        $recipientIds = app(ResolveChecklistStaffRecipients::class)->handle($actorId);
        $notify = app(CreateUserNotification::class);
        $usersById = User::query()
            ->whereIn('id', $recipientIds)
            ->get(['id', 'locale'])
            ->keyBy('id');
        foreach ($recipientIds as $recipientId) {
            $matched = $usersById->get($recipientId);
            $locale = AppLocale::normalize(is_string($matched?->locale) ? $matched->locale : null);
            $notify->handle(
                $recipientId,
                UserNotification::TYPE_CHECKLIST_ASSIGNED,
                __('notifications.checklist_assigned_title', [], $locale),
                $template->name,
                [
                    'link' => '/org/checklists/instances',
                    'entity_id' => $template->id,
                    'template_id' => $template->id,
                ],
            );
        }

        PublishLive::org([
            LiveTopics::CHECKLIST_INSTANCES,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return $created;
    }
}
