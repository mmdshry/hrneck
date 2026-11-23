<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Models\TenantMembership;
use App\Models\User;

class EnsureTenantMembership
{
    /**
     * @param  array{department_id?: int|null, department?: string|null}  $attributes
     */
    public function handle(User $user, string $tenantId, array $attributes = []): TenantMembership
    {
        $membership = TenantMembership::query()->firstOrNew([
            'user_id' => $user->id,
            'tenant_id' => $tenantId,
        ]);

        $membership->fill([
            'department_id' => array_key_exists('department_id', $attributes)
                ? $attributes['department_id']
                : $membership->department_id,
            'department' => array_key_exists('department', $attributes)
                ? $attributes['department']
                : $membership->department,
            'disabled_at' => null,
        ]);
        $membership->save();

        if ($user->tenant_id === null) {
            $user->forceFill([
                'tenant_id' => $tenantId,
                'department_id' => $membership->department_id,
                'department' => $membership->department,
            ])->save();
        } elseif ($user->tenant_id === $tenantId) {
            $user->forceFill([
                'department_id' => $membership->department_id,
                'department' => $membership->department,
            ])->save();
        }

        return $membership;
    }
}
