<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Jobs\SendEmployeeInviteJob;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\TargetProfileFields;
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
     * When an explicit password is given for a new login, it is set directly, the
     * login is usable immediately and no invite is queued.
     *
     * @return array{user: User, invited: bool, created: bool}
     */
    public function ensureUserForTarget(
        Target $target,
        string $tenantId,
        bool $queueInvite = true,
        ?string $password = null,
    ): array {
        $email = $this->normalizeEmail((string) $target->email);
        if ($email === '') {
            throw ValidationException::withMessages([
                'email' => ['Target email is required to provision a login.'],
            ]);
        }

        $user = $this->findOrgUserByEmail($email, $tenantId);
        $invited = false;
        $created = false;

        if ($user !== null && $password !== null) {
            throw ValidationException::withMessages([
                'email' => ['A login already exists for this employee in this organization. Set the password from the employee list instead.'],
            ]);
        }

        if ($user === null) {
            $this->assertNoPlatformAccount($email);
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
                'password' => Hash::make($password ?? Str::random(40)),
                'tenant_id' => $tenantId,
                'must_set_password' => $password === null,
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

            if ($queueInvite && $password === null) {
                SendEmployeeInviteJob::dispatch($user->id);
                $invited = true;
            }

            $this->linkTargetToUser($target, $user);

            return ['user' => $user, 'invited' => $invited, 'created' => true];
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
     * Every organization account is an employee. Ensure the account has a Target in the given tenant,
     * linking an existing Target by user id or email before creating a new one.
     */
    public function ensureTargetForAccount(User $user, ?string $tenantId = null): ?Target
    {
        $tenantId = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null)
            ?? $user->resolvedActiveTenantId()
            ?? (is_string($user->tenant_id) ? (string) $user->tenant_id : null);

        if ($tenantId === null || ! $user->belongsToTenant($tenantId)) {
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
            'joined_via' => TargetProfileFields::JOINED_VIA_ACCOUNT,
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
            ->withEmail($to)
            ->where('tenant_id', $tenantId)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($conflict) {
            throw ValidationException::withMessages([
                'email' => ['Cannot change employee email: another login in this organization already uses that address.'],
            ]);
        }

        $this->assertNoPlatformAccount($to);

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
            // Keep tenant_id: the login stays bound to this organization (disabled), so it can be
            // re-linked later and never becomes a platform account that could clash with a staff email.
            $user->forceFill([
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
        if ($user->tenant_id === $tenantId) {
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

    /**
     * The login this organization uses for an email. Other organizations may have their own login
     * with the same email, and those are never touched from here.
     */
    public function findOrgUserByEmail(string $email, string $tenantId): ?User
    {
        return User::query()
            ->withEmail($this->normalizeEmail($email))
            ->where('tenant_id', $tenantId)
            ->first();
    }

    /**
     * Platform staff accounts have no organization. Their email must stay unique across the platform.
     */
    public function findPlatformAccountByEmail(string $email): ?User
    {
        return User::query()
            ->withEmail($this->normalizeEmail($email))
            ->whereNull('tenant_id')
            ->first();
    }

    /**
     * Refuse to create an organization login for an email that belongs to a platform staff account.
     *
     * @throws ValidationException
     */
    public function assertNoPlatformAccount(string $email): void
    {
        if ($this->findPlatformAccountByEmail($email) !== null) {
            throw ValidationException::withMessages([
                'email' => ['This email belongs to a platform staff account and cannot be linked to an organization.'],
            ]);
        }
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
