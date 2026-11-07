<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Checklists\Models\ChecklistAnswer;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Checklists\Models\ChecklistTemplateVersion;
use App\Domains\Checklists\Support\ChecklistSchemaValidator;
use App\Domains\Checklists\Support\ChecklistVisibility;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SaveChecklistTemplate
{
    public function __construct(
        private ChecklistSchemaValidator $validator,
        private ChecklistVisibility $visibility,
        private LogChecklistActivity $audit,
    ) {}

    /**
     * @param  array{
     *     name?: string,
     *     category?: string,
     *     description?: string|null,
     *     status?: string,
     *     schema_json?: array{items?: mixed},
     *     apply_to_open?: bool,
     * }  $data
     */
    public function handle(ChecklistTemplate $template, array $data, ?int $actorId = null): ChecklistTemplate
    {
        if ($template->is_system) {
            abort(422, 'System templates are read-only. Copy them first.');
        }

        return DB::transaction(function () use ($template, $data, $actorId) {
            if (isset($data['name'])) {
                $template->name = (string) $data['name'];
            }
            if (array_key_exists('description', $data)) {
                $template->description = $data['description'];
            }
            if (isset($data['category'])) {
                $template->category = (string) $data['category'];
            }
            if (isset($data['status'])) {
                $template->status = (string) $data['status'];
            }

            $applyToOpen = (bool) ($data['apply_to_open'] ?? false);
            $newVersion = null;

            if (isset($data['schema_json'])) {
                $schema = $this->validator->validate($data['schema_json']);
                $next = $template->current_version + 1;
                $newVersion = ChecklistTemplateVersion::query()->create([
                    'template_id' => $template->id,
                    'version' => $next,
                    'schema_json' => $schema,
                    'created_by' => $actorId,
                ]);
                $template->current_version = $next;

                if ($applyToOpen) {
                    $this->applySchemaToOpenInstances($template, $newVersion, $actorId);
                }
            }

            $template->save();

            $this->audit->handle(
                'template_saved',
                'Checklist template saved',
                $template,
                [
                    'apply_to_open' => $applyToOpen,
                    'version' => $template->current_version,
                    'name' => $template->name,
                    'status' => $template->status,
                    'schema_changed' => $newVersion !== null,
                ],
                $actorId,
            );

            return $template->fresh(['versions']);
        });
    }

    /**
     * @param  array{
     *     name: string,
     *     category?: string,
     *     description?: string|null,
     *     status?: string,
     *     schema_json?: array{items?: mixed},
     * }  $data
     */
    public function create(array $data, ?int $actorId = null): ChecklistTemplate
    {
        $schema = $this->validator->validate($data['schema_json'] ?? ['items' => []]);
        $name = (string) $data['name'];
        $slugBase = Str::slug($name) ?: 'checklist';
        $slug = $slugBase;
        $i = 1;
        while (ChecklistTemplate::query()->where('slug', $slug)->exists()) {
            $slug = $slugBase.'-'.$i;
            $i++;
        }

        return DB::transaction(function () use ($data, $schema, $name, $slug, $actorId) {
            $template = ChecklistTemplate::query()->create([
                'name' => $name,
                'slug' => $slug,
                'category' => (string) ($data['category'] ?? 'custom'),
                'description' => $data['description'] ?? null,
                'status' => (string) ($data['status'] ?? 'draft'),
                'is_system' => false,
                'current_version' => 1,
            ]);

            ChecklistTemplateVersion::query()->create([
                'template_id' => $template->id,
                'version' => 1,
                'schema_json' => $schema,
                'created_by' => $actorId,
            ]);

            $this->audit->handle(
                'template_created',
                'Checklist template created',
                $template,
                [
                    'name' => $template->name,
                    'slug' => $template->slug,
                    'version' => 1,
                ],
                $actorId,
            );

            return $template->fresh(['versions']);
        });
    }

    private function applySchemaToOpenInstances(
        ChecklistTemplate $template,
        ChecklistTemplateVersion $version,
        ?int $actorId,
    ): void {
        $open = ChecklistInstance::query()
            ->where('template_id', $template->id)
            ->whereIn('status', [ChecklistInstance::STATUS_NOT_STARTED, ChecklistInstance::STATUS_IN_PROGRESS])
            ->with('answers')
            ->get();

        $validKeys = collect($version->schema_json['items'] ?? [])
            ->pluck('key')
            ->map(fn ($k) => (string) $k)
            ->all();

        foreach ($open as $instance) {
            $removed = [];
            foreach ($instance->answers as $answer) {
                if (! in_array($answer->item_key, $validKeys, true)) {
                    $removed[] = [
                        'item_key' => $answer->item_key,
                        'old' => $answer->decodedValue(),
                    ];
                    $answer->delete();
                }
            }

            $instance->template_version_id = $version->id;
            $instance->schema_snapshot = $version->schema_json;
            $instance->title = $template->name;

            $answersByKey = $this->answersMap($instance->fresh('answers'));
            $instance->progress_pct = $this->visibility->progressPercent($instance->schema_snapshot, $answersByKey);
            $instance->save();

            $this->audit->handle(
                'instance_schema_synced',
                'Open checklist instance synced to new template version',
                $instance,
                [
                    'template_id' => $template->id,
                    'version' => $version->version,
                    'removed_answers' => $removed,
                ],
                $actorId,
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function answersMap(ChecklistInstance $instance): array
    {
        $map = [];
        foreach ($instance->answers as $answer) {
            /** @var ChecklistAnswer $answer */
            $map[$answer->item_key] = $answer->decodedValue();
        }

        return $map;
    }
}
