<?php

namespace App\Http\Resources\Api\V1;

use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\ResolveActiveTarget;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use App\Support\ActiveOrgTenant;
use App\Support\AppLocale;
use App\Support\StaffTenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Stancl\Tenancy\Facades\Tenancy;

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

        if (! $this->resource->relationLoaded('memberships')) {
            $this->resource->load(['memberships.tenant']);
        } else {
            $this->resource->loadMissing('memberships.tenant');
        }

        $activeTenantId = $actingInTenant
            ? $staffTenantId
            : $this->resource->resolvedActiveTenantId();

        $membership = is_string($activeTenantId) && $activeTenantId !== ''
            ? $this->resource->membershipFor($activeTenantId)
            : null;

        $previousTeam = getPermissionsTeamId();
        if (is_string($activeTenantId) && $activeTenantId !== '') {
            setPermissionsTeamId($activeTenantId);
        } else {
            setPermissionsTeamId(null);
        }

        $includePermissions = $request->is('api/v1/auth/*')
            || $request->is('api/v1/auth')
            || $request->routeIs('api.v1.auth.*');

        try {
            // Auth/me must expand permissions under the correct team. List endpoints may keep an
            // eager-loaded roles relation to avoid N+1, but empty/stale relations must be wiped.
            $rolesEager = $this->resource->relationLoaded('roles')
                && $this->resource->getRelation('roles')->isNotEmpty()
                && ! $includePermissions;

            if (! $rolesEager && method_exists($this->resource, 'unsetRelation')) {
                $this->resource->unsetRelation('roles');
                $this->resource->unsetRelation('permissions');
            }

            $roles = method_exists($this->resource, 'getRoleNames')
                ? $this->getRoleNames()->values()->all()
                : [];
            $permissions = $includePermissions && method_exists($this->resource, 'getAllPermissions')
                ? $this->getAllPermissions()->pluck('name')->values()->all()
                : [];
        } finally {
            setPermissionsTeamId($previousTeam);
        }

        $hasAvatar = filled($this->avatar_path);
        $viewerId = $request->user()?->id;
        $selfStream = $hasAvatar && (
            $request->is('api/v1/auth/me')
            || $request->is('api/v1/auth/avatar')
            || ($viewerId !== null && (int) $viewerId === (int) $this->id)
        );

        $targetFields = $this->linkedTargetFields($activeTenantId);

        $memberships = $this->resource->memberships
            ->filter(fn (TenantMembership $m): bool => $m->isActive())
            ->values()
            ->map(function (TenantMembership $m): array {
                $tenant = $m->relationLoaded('tenant') ? $m->tenant : null;

                return [
                    'tenant_id' => $m->tenant_id,
                    'name' => $tenant->name ?? $m->tenant_id,
                    'department_id' => $m->department_id,
                    'department' => $m->department,
                ];
            })
            ->all();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'tenant_id' => $activeTenantId,
            'department_id' => $membership->department_id ?? $this->department_id,
            'department' => $membership->department ?? $this->department,
            'job_title' => $targetFields['job_title'],
            'target_department' => $targetFields['target_department'],
            'avatar_path' => $this->avatar_path,
            'avatar_url' => $hasAvatar
                ? ($selfStream
                    ? '/api/v1/auth/avatar'
                    : '/api/v1/org/users/'.$this->id.'/avatar')
                : null,
            'locale' => AppLocale::normalize(is_string($this->locale) ? $this->locale : null),
            'mfa_enabled' => (bool) $this->mfa_enabled,
            'roles' => $roles,
            'permissions' => $permissions,
            'is_platform_staff' => $isPlatformStaff,
            'staff_tenant_id' => $actingInTenant ? $staffTenantId : null,
            'acting_in_tenant' => $actingInTenant,
            'memberships' => $memberships,
            'needs_org_selection' => $this->resource->needsOrgSelection(),
            'active_tenant_id' => ActiveOrgTenant::id(),
        ];
    }

    /**
     * @return array{job_title: string|null, target_department: string|null}
     */
    private function linkedTargetFields(?string $tenantId): array
    {
        $empty = ['job_title' => null, 'target_department' => null];
        if (! is_string($tenantId) || $tenantId === '') {
            return $empty;
        }

        if ($this->resource->relationLoaded('linkedTarget')) {
            $target = $this->resource->getRelation('linkedTarget');
            if (! $target instanceof Target) {
                return $empty;
            }

            return [
                'job_title' => is_string($target->job_title) && $target->job_title !== ''
                    ? $target->job_title
                    : null,
                'target_department' => is_string($target->department) && $target->department !== ''
                    ? $target->department
                    : null,
            ];
        }

        $was = tenant('id');
        $initialized = false;

        try {
            if ($was !== $tenantId) {
                $tenant = Tenant::query()->find($tenantId);
                if ($tenant === null) {
                    return $empty;
                }
                Tenancy::initialize($tenant);
                $initialized = true;
            }

            $target = app(ResolveActiveTarget::class)->forUser($this->resource);
            if ($target === null) {
                return $empty;
            }

            return [
                'job_title' => is_string($target->job_title) && $target->job_title !== ''
                    ? $target->job_title
                    : null,
                'target_department' => is_string($target->department) && $target->department !== ''
                    ? $target->department
                    : null,
            ];
        } finally {
            if ($initialized) {
                if (is_string($was) && $was !== '') {
                    $previous = Tenant::query()->find($was);
                    if ($previous) {
                        Tenancy::initialize($previous);
                    } else {
                        Tenancy::end();
                    }
                } else {
                    Tenancy::end();
                }
            }
        }
    }
}
