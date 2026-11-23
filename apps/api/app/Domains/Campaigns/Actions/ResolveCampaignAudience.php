<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Validation\ValidationException;

class ResolveCampaignAudience
{
    /**
     * Merge explicit target IDs with members of the given groups.
     * Inactive employees are excluded.
     *
     * @param  list<int|string>  $targetIds
     * @param  list<int|string>  $groupIds
     * @return list<int>
     */
    public function handle(array $targetIds = [], array $groupIds = []): array
    {
        $resolved = array_map('intval', $targetIds);

        if ($groupIds !== []) {
            $fromGroups = Group::query()
                ->whereIn('id', array_map('intval', $groupIds))
                ->with('targets:id')
                ->get()
                ->flatMap(fn (Group $group) => $group->targets->pluck('id'))
                ->map(fn ($id) => (int) $id)
                ->all();

            $resolved = array_merge($resolved, $fromGroups);
        }

        $resolved = array_values(array_unique(array_filter($resolved, fn (int $id) => $id > 0)));

        if ($resolved === []) {
            throw ValidationException::withMessages([
                'target_ids' => ['Select at least one target or a group that has members.'],
            ]);
        }

        $activeIds = Target::query()
            ->whereIn('id', $resolved)
            ->where('status', 'active')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        if ($activeIds === []) {
            throw ValidationException::withMessages([
                'target_ids' => ['Select at least one active employee or a group with active members.'],
            ]);
        }

        return $activeIds;
    }
}
