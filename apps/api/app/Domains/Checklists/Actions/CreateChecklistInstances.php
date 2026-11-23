<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Notifications\Actions\CreateUserNotification;
use App\Domains\Notifications\Actions\QueueNotificationEmail;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Notifications\Support\ResolveUsersFromTargets;
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

        $createdTargetIds = array_values(array_unique(array_map(
            static fn (ChecklistInstance $instance): int => (int) $instance->target_id,
            $created,
        )));
        $userIds = app(ResolveUsersFromTargets::class)->handle($createdTargetIds);
        $notify = app(CreateUserNotification::class);
        $usersById = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'locale'])
            ->keyBy('id');
        foreach ($userIds as $userId) {
            $matched = $usersById->get($userId);
            $locale = AppLocale::normalize(is_string($matched?->locale) ? $matched->locale : null);
            $notify->handle(
                $userId,
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

        $frontend = rtrim((string) config('brand.frontend_url', config('app.url')), '/');
        $link = $frontend.'/org/checklists/instances';
        $queueEmail = app(QueueNotificationEmail::class);
        $targets = Target::query()->whereIn('id', $createdTargetIds)->get(['id', 'email', 'first_name']);
        $localeByEmail = User::query()
            ->whereIn('email', $targets->pluck('email')->filter()->all())
            ->get(['email', 'locale'])
            ->keyBy(fn (User $u): string => strtolower(trim((string) $u->email)));

        foreach ($targets as $target) {
            $email = trim((string) $target->email);
            if ($email === '') {
                continue;
            }
            $matched = $localeByEmail->get(strtolower($email));
            $locale = AppLocale::normalize(is_string($matched?->locale) ? $matched->locale : null);
            $greeting = $target->first_name !== null && $target->first_name !== ''
                ? __('notifications.checklist_assigned_greeting_named', ['name' => $target->first_name], $locale)
                : __('notifications.checklist_assigned_greeting', [], $locale);
            $queueEmail->handle(
                $email,
                __('notifications.checklist_assigned_subject', [
                    'brand' => config('brand.short'),
                    'name' => $template->name,
                ], $locale),
                $greeting.__('notifications.checklist_assigned_body', [
                    'name' => $template->name,
                    'url' => $link,
                ], $locale),
                $locale,
            );
        }

        PublishLive::org([
            LiveTopics::CHECKLIST_INSTANCES,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return $created;
    }
}
