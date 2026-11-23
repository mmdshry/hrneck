<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Jobs\SendEmployeeInviteJob;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Role;
use App\Models\TenantMembership;
use App\Models\User;
use App\Support\ActiveOrgTenant;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProvisionEmployeePair
{
    public function __construct(
        private readonly SeedRbacCatalog $rbac,
        private readonly EnsureTenantMembership $memberships,
    ) {}

    /**
     * Ensure a login User exists for this Target. New users get learner + invite.
     *
     * @return array{user: User, invited: bool, created: bool}
     */
    public function ensureUserForTarget(Target $target, string $tenantId, bool $queueInvite = true): array
    {
        $email = $this->normalizeEmail((string) $target->email);
        if ($email === '') {
            throw ValidationException::withMessages([
                'email' => ['Target email is required to provision a login.'],
            ]);
        }

        $user = $this->findUserByEmail($email);
        $invited = false;
        $created = false;

        if ($user === null) {
            $this->rbac->ensureLearnerRole($tenantId);

            $name = trim(implode(' ', array_filter([
                $target->first_name,
                $target->last_name,
            ])));
            if ($name === '') {
                $name = $email;
            }

            $user = User::query()->create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(Str::random(40)),
                'tenant_id' => $tenantId,
                'must_set_password' => true,
            ]);
            $user->forceFill([
                'email_verified_at' => now(),
                'disabled_at' => null,
                'department_id' => $target->department_id,
                'department' => $target->department,
            ])->save();

            $this->memberships->handle($user, $tenantId, [
                'department_id' => $target->department_id,
                'department' => $target->department,
            ]);

            $this->assignLearnerRole($user, $tenantId);

            if ($queueInvite) {
                SendEmployeeInviteJob::dispatch($user->id);
                $invited = true;
            }

            $this->linkTargetToUser($target, $user);

            return ['user' => $user, 'invited' => $invited, 'created' => true];
        }

        if ($user->isPlatformStaff()) {
            throw ValidationException::withMessages([
                'email' => ['This email belongs to a platform staff account and cannot be linked to an employee.'],
            ]);
        }

        $hadMembership = $user->belongsToTenant($tenantId, activeOnly: false);

        $this->memberships->handle($user, $tenantId, [
            'department_id' => $target->department_id,
            'department' => $target->department,
        ]);

        if ($user->disabled_at !== null && $target->status === 'active') {
            $user->forceFill(['disabled_at' => null])->save();
        }

        if (! $this->hasOperatorRoles($user, $tenantId)) {
            $this->assignLearnerRole($user, $tenantId);
        }

        $this->linkTargetToUser($target, $user);
        $this->syncUserDepartmentFromTarget($target, $tenantId);

        if (! $hadMembership && $queueInvite && $user->must_set_password) {
            SendEmployeeInviteJob::dispatch($user->id);
            $invited = true;
        }

        return ['user' => $user->fresh(['memberships']) ?? $user, 'invited' => $invited, 'created' => $created];
    }

    /**
     * When a User is given the learner role, ensure a Target exists in the given tenant.
     */
    public function ensureTargetForLearner(User $user, ?string $tenantId = null): ?Target
    {
        $tenantId = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null)
            ?? $user->resolvedActiveTenantId()
            ?? (is_string($user->tenant_id) ? (string) $user->tenant_id : null);

        if ($tenantId === null || ! $user->belongsToTenant($tenantId)) {
            return null;
        }

        if (! $this->userHasLearnerRole($user, $tenantId)) {
            return null;
        }

        $existing = Target::query()
            ->where('user_id', $user->id)
            ->first();

        if ($existing === null) {
            $email = $this->normalizeEmail((string) $user->email);
            $existing = Target::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();
        }

        if ($existing !== null) {
            $this->linkTargetToUser($existing, $user);

            return $existing;
        }

        $parts = preg_split('/\s+/', trim((string) $user->name), 2) ?: [];
        $email = $this->normalizeEmail((string) $user->email);
        $membership = $user->membershipFor($tenantId);

        $target = Target::query()->create([
            'email' => $email,
            'first_name' => $parts[0] ?? null,
            'last_name' => $parts[1] ?? null,
            'status' => 'active',
            'user_id' => $user->id,
            'joined_via' => 'learner_role',
            'department_id' => $membership?->department_id,
            'department' => $membership?->department,
        ]);

        return $target;
    }

    public function syncUserDepartmentFromTarget(Target $target, string $tenantId): void
    {
        if ($target->user_id === null) {
            return;
        }

        $user = User::query()
            ->inTenant($tenantId)
            ->whereKey($target->user_id)
            ->first();

        if ($user === null) {
            return;
        }

        $this->memberships->handle($user, $tenantId, [
            'department_id' => $target->department_id,
            'department' => $target->department,
        ]);
    }

    public function syncUserEmailFromTarget(string $tenantId, string $previousEmail, string $nextEmail): void
    {
        $from = $this->normalizeEmail($previousEmail);
        $to = $this->normalizeEmail($nextEmail);
        if ($from === '' || $to === '' || $from === $to) {
            return;
        }

        $user = User::query()
            ->inTenant($tenantId)
            ->whereRaw('LOWER(email) = ?', [$from])
            ->first();

        if ($user === null) {
            return;
        }

        $conflict = User::query()
            ->whereRaw('LOWER(email) = ?', [$to])
            ->where('id', '!=', $user->id)
            ->exists();

        if ($conflict) {
            throw ValidationException::withMessages([
                'email' => ['Cannot change employee email: another login already uses that address.'],
            ]);
        }

        $user->forceFill(['email' => $to])->save();
    }

    public function onTargetDeactivated(Target $target, string $tenantId): void
    {
        // Employee surfaces gate on Target.status; operators keep /org access.
        unset($target, $tenantId);
    }

    public function onTargetDeleted(string $email, string $tenantId): void
    {
        $user = User::query()
            ->inTenant($tenantId, activeOnly: false)
            ->whereRaw('LOWER(email) = ?', [$this->normalizeEmail($email)])
            ->first();

        if ($user === null) {
            return;
        }

        setPermissionsTeamId($tenantId);
        try {
            if ($user->hasRole(OrgPermissionCatalog::LEARNER)) {
                $user->removeRole(OrgPermissionCatalog::LEARNER);
            }

            $remaining = $user->getRoleNames()->values()->all();
            if ($remaining === []) {
                $this->removeMembershipKeepingOthers($user, $tenantId);
            }
        } finally {
            setPermissionsTeamId(null);
        }
    }

    public function removeMembershipKeepingOthers(User $user, string $tenantId): void
    {
        TenantMembership::query()
            ->where('user_id', $user->id)
            ->where('tenant_id', $tenantId)
            ->delete();

        setPermissionsTeamId($tenantId);
        try {
            $user->syncRoles([]);
        } finally {
            setPermissionsTeamId(null);
        }

        $remaining = $user->memberships()->active()->get();
        if ($remaining->isEmpty()) {
            $user->forceFill([
                'tenant_id' => null,
                'department_id' => null,
                'department' => null,
                'disabled_at' => now(),
                'remember_token' => Str::random(60),
            ])->save();

            if (ActiveOrgTenant::matches($tenantId)) {
                ActiveOrgTenant::clear();
            }

            return;
        }

        $next = $remaining->first();
        if ($user->tenant_id === $tenantId && $next !== null) {
            $user->forceFill([
                'tenant_id' => $next->tenant_id,
                'department_id' => $next->department_id,
                'department' => $next->department,
            ])->save();
        }

        if (ActiveOrgTenant::matches($tenantId)) {
            ActiveOrgTenant::set($remaining->count() === 1 ? $remaining->first()->tenant_id : null);
        }
    }

    public function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    public function findUserByEmail(string $email): ?User
    {
        return User::query()
            ->whereRaw('LOWER(email) = ?', [$this->normalizeEmail($email)])
            ->first();
    }

    public function linkTargetToUser(Target $target, User $user): void
    {
        if ((int) $target->user_id === (int) $user->id) {
            return;
        }

        $target->forceFill(['user_id' => $user->id])->save();
    }

    private function assignLearnerRole(User $user, string $tenantId): void
    {
        $this->rbac->ensureLearnerRole($tenantId);

        setPermissionsTeamId($tenantId);
        try {
            $role = Role::findOrCreate(OrgPermissionCatalog::LEARNER, OrgPermissionCatalog::GUARD);
            if (! $user->hasRole($role)) {
                $user->assignRole($role);
            }
        } finally {
            setPermissionsTeamId(null);
        }
    }

    private function userHasLearnerRole(User $user, string $tenantId): bool
    {
        setPermissionsTeamId($tenantId);
        try {
            return $user->hasRole(OrgPermissionCatalog::LEARNER);
        } finally {
            setPermissionsTeamId(null);
        }
    }

    private function hasOperatorRoles(User $user, string $tenantId): bool
    {
        setPermissionsTeamId($tenantId);
        try {
            $roles = $user->getRoleNames()->values()->all();
        } finally {
            setPermissionsTeamId(null);
        }

        foreach ($roles as $role) {
            if ($role !== OrgPermissionCatalog::LEARNER) {
                return true;
            }
        }

        return false;
    }
}
