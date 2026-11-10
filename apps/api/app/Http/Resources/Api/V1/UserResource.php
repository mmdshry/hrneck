<?php

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use App\Support\StaffTenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Resolve staff flags before loading Spatie relations — wrong team context
        // can cache empty roles and break isPlatformStaff().
        $isPlatformStaff = $this->resource->isPlatformStaff();
        $staffTenantId = StaffTenant::id();
        $actingInTenant = $isPlatformStaff && is_string($staffTenantId) && $staffTenantId !== '';

        $previousTeam = getPermissionsTeamId();
        if ($this->tenant_id) {
            setPermissionsTeamId($this->tenant_id);
        } else {
            setPermissionsTeamId(null);
        }

        try {
            if (method_exists($this->resource, 'unsetRelation')) {
                $this->resource->unsetRelation('roles');
                $this->resource->unsetRelation('permissions');
            }
            $roles = method_exists($this->resource, 'getRoleNames')
                ? $this->getRoleNames()->values()->all()
                : [];
            $permissions = method_exists($this->resource, 'getAllPermissions')
                ? $this->getAllPermissions()->pluck('name')->values()->all()
                : [];
        } finally {
            setPermissionsTeamId($previousTeam);
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'tenant_id' => $this->tenant_id,
            'mfa_enabled' => (bool) $this->mfa_enabled,
            'roles' => $roles,
            'permissions' => $permissions,
            'is_platform_staff' => $isPlatformStaff,
            'staff_tenant_id' => $actingInTenant ? $staffTenantId : null,
            'acting_in_tenant' => $actingInTenant,
        ];
    }
}
