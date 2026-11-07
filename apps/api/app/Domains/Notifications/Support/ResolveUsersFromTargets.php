<?php

namespace App\Domains\Notifications\Support;

use App\Domains\TargetsGroups\Models\Target;
use App\Models\User;

final class ResolveUsersFromTargets
{
    /**
     * @param  list<int>  $targetIds
     * @return list<int>
     */
    public function handle(array $targetIds): array
    {
        if ($targetIds === []) {
            return [];
        }

        $emails = Target::query()
            ->whereIn('id', $targetIds)
            ->pluck('email')
            ->filter()
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->unique()
            ->values()
            ->all();

        if ($emails === []) {
            return [];
        }

        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        if ($tenantId === null || $tenantId === '') {
            return [];
        }

        return User::query()
            ->where('tenant_id', $tenantId)
            ->get(['id', 'email'])
            ->filter(function (User $user) use ($emails): bool {
                return in_array(strtolower(trim((string) $user->email)), $emails, true);
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}
