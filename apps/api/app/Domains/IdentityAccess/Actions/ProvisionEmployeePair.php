<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Jobs\SendEmployeeInviteJob;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProvisionEmployeePair
{
    public function __construct(private readonly SeedRbacCatalog $rbac) {}

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
            ])->save();

            $this->assignLearnerRole($user, $tenantId);

            if ($queueInvite) {
                SendEmployeeInviteJob::dispatch($user->id);
                $invited = true;
            }

            return ['user' => $user, 'invited' => $invited, 'created' => true];
        }

        if ($user->tenant_id === null) {
            throw ValidationException::withMessages([
                'email' => ['This email belongs to a platform staff account and cannot be linked to an employee.'],
            ]);
        }

        if ($user->tenant_id !== $tenantId) {
            throw ValidationException::withMessages([
                'email' => ['A user with this email already exists in another organization.'],
            ]);
        }

        if ($user->disabled_at !== null && $target->status === 'active') {
            $user->forceFill(['disabled_at' => null])->save();
        }

        if (! $this->hasOperatorRoles($user, $tenantId)) {
            $this->assignLearnerRole($user, $tenantId);
        }

        return ['user' => $user->fresh() ?? $user, 'invited' => false, 'created' => false];
    }

    /**
     * When a User is given the learner role, ensure a Target exists.
     */
    public function ensureTargetForLearner(User $user): ?Target
    {
        if ($user->tenant_id === null) {
            return null;
        }

        if (! $this->userHasLearnerRole($user)) {
            return null;
        }

        $email = $this->normalizeEmail((string) $user->email);
        $existing = Target::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        $parts = preg_split('/\s+/', trim((string) $user->name), 2) ?: [];

        return Target::query()->create([
            'email' => $email,
            'first_name' => $parts[0] ?? null,
            'last_name' => $parts[1] ?? null,
            'status' => 'active',
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
            ->where('tenant_id', $tenantId)
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
        // No user mutation required beyond ensuring disabled learners stay blocked via Target.
        unset($target, $tenantId);
    }

    public function onTargetDeleted(string $email, string $tenantId): void
    {
        $user = User::query()
            ->where('tenant_id', $tenantId)
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
                $user->forceFill([
                    'disabled_at' => now(),
                    'remember_token' => Str::random(60),
                ])->save();
            }
        } finally {
            setPermissionsTeamId(null);
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

    private function userHasLearnerRole(User $user): bool
    {
        if ($user->tenant_id === null) {
            return false;
        }

        setPermissionsTeamId($user->tenant_id);
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
