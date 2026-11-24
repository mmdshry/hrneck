<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Checklists\Models\ChecklistAnswer;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Support\ChecklistVisibility;
use App\Domains\TargetsGroups\Models\Target;

class PrefillChecklistInstanceFromTarget
{
    public function __construct(private readonly ChecklistVisibility $visibility) {}

    public function handle(ChecklistInstance $instance, Target $target): ChecklistInstance
    {
        $schema = $instance->schema_snapshot;
        $items = is_array($schema['items'] ?? null) ? $schema['items'] : [];
        $keys = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $key = (string) ($item['key'] ?? '');
            if ($key !== '') {
                $keys[$key] = true;
            }
        }

        $managerEmail = null;
        if ($target->manager_target_id !== null) {
            $managerEmail = Target::query()->whereKey($target->manager_target_id)->value('email');
            $managerEmail = is_string($managerEmail) ? strtolower(trim($managerEmail)) : null;
        }

        $prefills = [];
        if (isset($keys['role_title']) && is_string($target->job_title) && trim($target->job_title) !== '') {
            $prefills['role_title'] = trim($target->job_title);
        }
        if (isset($keys['start_date']) && $target->hire_date !== null) {
            $prefills['start_date'] = $target->hire_date->toDateString();
        }
        if (isset($keys['manager_email']) && is_string($managerEmail) && $managerEmail !== '') {
            $prefills['manager_email'] = $managerEmail;
        }

        if ($prefills === []) {
            return $instance;
        }

        foreach ($prefills as $itemKey => $value) {
            $existing = ChecklistAnswer::query()
                ->where('instance_id', $instance->id)
                ->where('item_key', $itemKey)
                ->exists();
            if ($existing) {
                continue;
            }

            ChecklistAnswer::query()->create([
                'instance_id' => $instance->id,
                'item_key' => $itemKey,
                'value_json' => ['value' => $value],
                'updated_by' => null,
            ]);
        }

        $instance->load('answers');
        $answersByKey = [];
        foreach ($instance->answers as $answer) {
            $answersByKey[$answer->item_key] = $answer->decodedValue();
        }

        $instance->forceFill([
            'progress_pct' => $this->visibility->progressPercent($schema, $answersByKey),
            'status' => ChecklistInstance::STATUS_IN_PROGRESS,
        ])->save();

        return $instance->fresh(['answers']) ?? $instance;
    }
}
