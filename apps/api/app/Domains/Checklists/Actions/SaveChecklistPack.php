<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Checklists\Models\ChecklistPack;
use App\Domains\Checklists\Models\ChecklistPackItem;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaveChecklistPack
{
    public function __construct(private LogChecklistActivity $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, ?int $actorId = null): ChecklistPack
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw ValidationException::withMessages([
                'name' => ['Pack name is required.'],
            ]);
        }

        $templateIds = $this->normalizeTemplateIds($data['template_ids'] ?? []);
        $this->assertAssignableTemplates($templateIds);

        $pack = DB::transaction(function () use ($data, $name, $templateIds, $actorId) {
            $pack = ChecklistPack::query()->create([
                'name' => $name,
                'slug' => $this->uniqueSlug($name),
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? ChecklistPack::STATUS_DRAFT,
                'auto_assign_on_create' => (bool) ($data['auto_assign_on_create'] ?? false),
            ]);

            $this->syncItems($pack, $templateIds);

            $this->audit->handle(
                'pack_created',
                'Checklist pack created',
                $pack,
                [
                    'template_ids' => $templateIds,
                    'auto_assign_on_create' => $pack->auto_assign_on_create,
                ],
                $actorId,
            );

            return $pack;
        });

        PublishLive::org([LiveTopics::CHECKLISTS]);

        return $pack->fresh(['items.template']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(ChecklistPack $pack, array $data, ?int $actorId = null): ChecklistPack
    {
        if (array_key_exists('template_ids', $data)) {
            $templateIds = $this->normalizeTemplateIds($data['template_ids']);
            $this->assertAssignableTemplates($templateIds);
        } else {
            $templateIds = null;
        }

        $updated = DB::transaction(function () use ($pack, $data, $templateIds, $actorId) {
            if (array_key_exists('name', $data)) {
                $name = trim((string) $data['name']);
                if ($name === '') {
                    throw ValidationException::withMessages([
                        'name' => ['Pack name is required.'],
                    ]);
                }
                if ($name !== $pack->name) {
                    $pack->name = $name;
                    $pack->slug = $this->uniqueSlug($name, $pack->id);
                }
            }

            if (array_key_exists('description', $data)) {
                $pack->description = $data['description'];
            }
            if (array_key_exists('status', $data)) {
                $pack->status = (string) $data['status'];
            }
            if (array_key_exists('auto_assign_on_create', $data)) {
                $pack->auto_assign_on_create = (bool) $data['auto_assign_on_create'];
            }

            $pack->save();

            if ($templateIds !== null) {
                $this->syncItems($pack, $templateIds);
            }

            $this->audit->handle(
                'pack_updated',
                'Checklist pack updated',
                $pack,
                [
                    'template_ids' => $templateIds ?? $pack->items()->pluck('template_id')->all(),
                    'status' => $pack->status,
                    'auto_assign_on_create' => $pack->auto_assign_on_create,
                ],
                $actorId,
            );

            return $pack;
        });

        PublishLive::org([LiveTopics::CHECKLISTS]);

        return $updated->fresh(['items.template']);
    }

    /**
     * @param  list<int>  $templateIds
     */
    private function syncItems(ChecklistPack $pack, array $templateIds): void
    {
        ChecklistPackItem::query()->where('pack_id', $pack->id)->delete();

        foreach ($templateIds as $index => $templateId) {
            ChecklistPackItem::query()->create([
                'pack_id' => $pack->id,
                'template_id' => $templateId,
                'sort_order' => $index + 1,
            ]);
        }
    }

    /**
     * @return list<int>
     */
    private function normalizeTemplateIds(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $ids = [];
        foreach ($raw as $value) {
            $id = (int) $value;
            if ($id > 0 && ! in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    /**
     * @param  list<int>  $templateIds
     */
    private function assertAssignableTemplates(array $templateIds): void
    {
        if ($templateIds === []) {
            throw ValidationException::withMessages([
                'template_ids' => ['Select at least one non-system template.'],
            ]);
        }

        $templates = ChecklistTemplate::query()
            ->whereIn('id', $templateIds)
            ->get()
            ->keyBy('id');

        foreach ($templateIds as $templateId) {
            $template = $templates->get($templateId);
            if ($template === null) {
                throw ValidationException::withMessages([
                    'template_ids' => ["Template #{$templateId} was not found."],
                ]);
            }
            if ($template->is_system) {
                throw ValidationException::withMessages([
                    'template_ids' => ['Packs cannot include system templates. Copy them first.'],
                ]);
            }
            if ($template->current_version < 1 || $template->latestVersion() === null) {
                throw ValidationException::withMessages([
                    'template_ids' => ["Template \"{$template->name}\" has no schema version."],
                ]);
            }
        }
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'checklist-pack';
        $slug = $base;
        $i = 1;
        while (
            ChecklistPack::query()
                ->when($ignoreId !== null, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }
}
