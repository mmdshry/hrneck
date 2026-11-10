<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistPack;
use App\Domains\Checklists\Models\ChecklistTemplate;
use Illuminate\Validation\ValidationException;

class AssignChecklistPack
{
    public function __construct(
        private CreateChecklistInstances $createInstances,
        private LogChecklistActivity $audit,
    ) {}

    /**
     * @param  list<int|string>  $targetIds
     * @param  list<int|string>  $groupIds
     * @return list<ChecklistInstance>
     */
    public function handle(
        ChecklistPack $pack,
        array $targetIds = [],
        array $groupIds = [],
        ?int $actorId = null,
        bool $requireCreated = true,
    ): array {
        if ($pack->status === ChecklistPack::STATUS_ARCHIVED) {
            throw ValidationException::withMessages([
                'pack_id' => ['Archived packs cannot be assigned.'],
            ]);
        }

        $pack->loadMissing(['items.template']);
        $items = $pack->items;
        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'pack_id' => ['Pack has no templates to assign.'],
            ]);
        }

        $created = [];
        foreach ($items as $item) {
            /** @var ChecklistTemplate|null $template */
            $template = $item->template;
            if ($template === null || $template->is_system || $template->current_version < 1) {
                continue;
            }

            $batch = $this->createInstances->handle(
                $template,
                $targetIds,
                $groupIds,
                $actorId,
                requireCreated: false,
            );
            foreach ($batch as $instance) {
                $created[] = $instance;
            }
        }

        if ($created === [] && $requireCreated) {
            throw ValidationException::withMessages([
                'target_ids' => ['No new instances created. Targets may already have open checklists for this pack.'],
            ]);
        }

        if ($created !== []) {
            $this->audit->handle(
                'pack_assigned',
                'Checklist pack assigned to employees',
                $pack,
                [
                    'pack_id' => $pack->id,
                    'instance_ids' => array_map(
                        static fn (ChecklistInstance $instance): int => (int) $instance->id,
                        $created,
                    ),
                    'instance_count' => count($created),
                ],
                $actorId,
            );
        }

        return $created;
    }
}
