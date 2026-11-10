<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Checklists\Models\ChecklistAnswer;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Support\ChecklistItemTypes;
use App\Domains\Checklists\Support\ChecklistVisibility;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateChecklistInstance
{
    public function __construct(
        private ChecklistVisibility $visibility,
        private LogChecklistActivity $audit,
    ) {}

    /**
     * @param  array{
     *     status?: string,
     *     reopen?: bool,
     *     answers?: list<array{
     *         item_key: string,
     *         value?: mixed,
     *         file_disk_path?: string|null,
     *         file_mime?: string|null,
     *         file_size?: int|null,
     *     }>
     * }  $data
     */
    public function handle(ChecklistInstance $instance, array $data, ?int $actorId = null): ChecklistInstance
    {
        $reopen = (bool) ($data['reopen'] ?? false);

        if ($instance->status === ChecklistInstance::STATUS_CANCELLED && ! $reopen) {
            throw ValidationException::withMessages([
                'status' => ['Cancelled checklists cannot be updated.'],
            ]);
        }

        return DB::transaction(function () use ($instance, $data, $actorId) {
            $schema = $instance->schema_snapshot ?? ['items' => []];
            $itemsByKey = [];
            foreach ($schema['items'] ?? [] as $item) {
                if (is_array($item) && isset($item['key'])) {
                    $itemsByKey[(string) $item['key']] = $item;
                }
            }

            if (isset($data['answers']) && is_array($data['answers'])) {
                foreach ($data['answers'] as $row) {
                    $key = (string) ($row['item_key'] ?? '');
                    if ($key === '' || ! isset($itemsByKey[$key])) {
                        throw ValidationException::withMessages([
                            'answers' => ["Unknown item_key [{$key}]."],
                        ]);
                    }

                    $item = $itemsByKey[$key];
                    if (! in_array((string) $item['type'], ChecklistItemTypes::answerable(), true)) {
                        throw ValidationException::withMessages([
                            'answers' => ["Item [{$key}] is not answerable."],
                        ]);
                    }

                    $answer = ChecklistAnswer::query()->firstOrNew([
                        'instance_id' => $instance->id,
                        'item_key' => $key,
                    ]);

                    $old = $answer->exists ? [
                        'value' => $answer->decodedValue(),
                        'file_disk_path' => $answer->file_disk_path,
                    ] : null;

                    if (array_key_exists('value', $row)) {
                        $answer->value_json = ['value' => $row['value']];
                    }
                    if (array_key_exists('file_disk_path', $row)) {
                        $answer->file_disk_path = $row['file_disk_path'];
                        $answer->file_mime = $row['file_mime'] ?? null;
                        $answer->file_size = $row['file_size'] ?? null;
                        if ($answer->file_disk_path && ! array_key_exists('value', $row)) {
                            $answer->value_json = ['value' => basename((string) $answer->file_disk_path)];
                        }
                    }
                    $answer->updated_by = $actorId;
                    $answer->save();

                    $this->audit->handle(
                        'answer_updated',
                        "Checklist answer updated: {$key}",
                        $instance,
                        [
                            'item_key' => $key,
                            'old' => $old,
                            'new' => [
                                'value' => $answer->decodedValue(),
                                'file_disk_path' => $answer->file_disk_path,
                            ],
                        ],
                        $actorId,
                    );
                }
            }

            $instance->load('answers');
            $answersByKey = [];
            foreach ($instance->answers as $answer) {
                $answersByKey[$answer->item_key] = $answer->decodedValue();
            }

            $instance->progress_pct = $this->visibility->progressPercent($schema, $answersByKey);

            if (isset($data['status'])) {
                $status = (string) $data['status'];
                $allowed = [
                    ChecklistInstance::STATUS_NOT_STARTED,
                    ChecklistInstance::STATUS_IN_PROGRESS,
                    ChecklistInstance::STATUS_COMPLETED,
                    ChecklistInstance::STATUS_CANCELLED,
                ];
                if (! in_array($status, $allowed, true)) {
                    throw ValidationException::withMessages(['status' => ['Invalid status.']]);
                }

                $oldStatus = $instance->status;
                if ($status === ChecklistInstance::STATUS_COMPLETED) {
                    $this->assertRequiredComplete($schema, $answersByKey);
                    $instance->completed_at = now();
                    $instance->progress_pct = 100;
                } elseif ($oldStatus === ChecklistInstance::STATUS_COMPLETED) {
                    $instance->completed_at = null;
                }
                if ($status === ChecklistInstance::STATUS_IN_PROGRESS && $instance->started_at === null) {
                    $instance->started_at = now();
                }
                if ($status === ChecklistInstance::STATUS_CANCELLED) {
                    $instance->completed_at = null;
                }

                $instance->status = $status;

                $this->audit->handle(
                    'status_changed',
                    'Checklist instance status changed',
                    $instance,
                    [
                        'old' => $oldStatus,
                        'new' => $status,
                    ],
                    $actorId,
                );
            } elseif ($instance->status === ChecklistInstance::STATUS_NOT_STARTED && isset($data['answers'])) {
                $instance->status = ChecklistInstance::STATUS_IN_PROGRESS;
                $instance->started_at = $instance->started_at ?? now();
                $this->audit->handle(
                    'status_changed',
                    'Checklist instance marked in progress',
                    $instance,
                    [
                        'old' => ChecklistInstance::STATUS_NOT_STARTED,
                        'new' => ChecklistInstance::STATUS_IN_PROGRESS,
                    ],
                    $actorId,
                );
            }

            $instance->save();

            return $instance->fresh(['answers', 'target', 'template']);
        });
    }

    /**
     * @param  array{items?: list<array<string, mixed>>}  $schema
     * @param  array<string, mixed>  $answersByKey
     */
    private function assertRequiredComplete(array $schema, array $answersByKey): void
    {
        foreach ($this->visibility->visibleAnswerableItems($schema, $answersByKey) as $item) {
            if (! ($item['required'] ?? false)) {
                continue;
            }
            $key = (string) $item['key'];
            if (! $this->visibility->dependenciesMet($item, $answersByKey, $schema)) {
                throw ValidationException::withMessages([
                    'status' => ["Complete dependencies for [{$key}] before finishing."],
                ]);
            }
            if (! $this->visibility->isFilled($answersByKey[$key] ?? null)) {
                throw ValidationException::withMessages([
                    'status' => ["Required item [{$key}] is incomplete."],
                ]);
            }
        }
    }
}
