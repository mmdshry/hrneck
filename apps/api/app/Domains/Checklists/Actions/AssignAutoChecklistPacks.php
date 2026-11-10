<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Checklists\Models\ChecklistPack;
use App\Domains\TargetsGroups\Models\Target;
use Throwable;

class AssignAutoChecklistPacks
{
    public function __construct(private AssignChecklistPack $assignPack) {}

    /**
     * Assign all published packs flagged for auto-assign on employee create.
     *
     * @return int Number of checklist instances created
     */
    public function handle(Target $target, ?int $actorId = null): int
    {
        $packs = ChecklistPack::query()
            ->where('status', ChecklistPack::STATUS_PUBLISHED)
            ->where('auto_assign_on_create', true)
            ->with(['items.template'])
            ->orderBy('id')
            ->get();

        $created = 0;
        foreach ($packs as $pack) {
            try {
                $instances = $this->assignPack->handle(
                    $pack,
                    [$target->id],
                    [],
                    $actorId,
                    requireCreated: false,
                );
                $created += count($instances);
            } catch (Throwable) {
                // Employee create must not fail because of checklist assignment.
                continue;
            }
        }

        return $created;
    }
}
