<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Notifications\Actions\CreateUserNotification;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Notifications\Support\ResolveUsersFromTargets;
use App\Domains\TargetsGroups\Models\Target;
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

        $resolved = $this->audience->handle($targetIds, $groupIds);
        $created = [];

        DB::transaction(function () use ($template, $version, $resolved, $actorId, &$created) {
            foreach ($resolved as $targetId) {
                $existsOpen = ChecklistInstance::query()
                    ->where('template_id', $template->id)
                    ->where('target_id', $targetId)
                    ->whereIn('status', [
                        ChecklistInstance::STATUS_NOT_STARTED,
                        ChecklistInstance::STATUS_IN_PROGRESS,
                    ])
                    ->exists();

                if ($existsOpen) {
                    continue;
                }

                if (! Target::query()->whereKey($targetId)->exists()) {
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

                $created[] = $instance;
            }
        });

        if ($created === []) {
            throw ValidationException::withMessages([
                'target_ids' => ['No new instances created. Targets may already have an open checklist for this template.'],
            ]);
        }

        $createdTargetIds = array_values(array_unique(array_map(
            static fn (ChecklistInstance $instance): int => (int) $instance->target_id,
            $created,
        )));
        $userIds = app(ResolveUsersFromTargets::class)->handle($createdTargetIds);
        $notify = app(CreateUserNotification::class);
        foreach ($userIds as $userId) {
            $notify->handle(
                $userId,
                UserNotification::TYPE_CHECKLIST_ASSIGNED,
                'Checklist assigned',
                $template->name,
                [
                    'link' => '/org/checklists/instances',
                    'entity_id' => $template->id,
                    'template_id' => $template->id,
                ],
            );
        }

        return $created;
    }
}
