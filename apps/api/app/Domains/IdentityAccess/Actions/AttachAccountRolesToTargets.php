<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Support\Collection;

/**
 * Sets `account_roles` (role names in one organization) on each employee's linked login.
 * Used by the employee list, the employee detail and the live snapshot so all three agree.
 */
final class AttachAccountRolesToTargets
{
    public function __construct(private ListAccountRoleNames $roles) {}

    /**
     * @param  Collection<int, Target>  $targets
     */
    public function handle(Collection $targets, string $tenantId): void
    {
        $userIds = $targets
            ->pluck('user_id')
            ->filter()
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        $rolesByUser = $this->roles->handle($userIds, $tenantId);

        foreach ($targets as $target) {
            $target->setAttribute('account_roles', $rolesByUser[(int) $target->user_id] ?? []);
        }
    }
}
