<?php

namespace App\Domains\TargetsGroups\Support;

use App\Domains\TargetsGroups\Models\Target;
use App\Models\User;
use Illuminate\Validation\ValidationException;

final class ResolveActiveTarget
{
    public function idForUser(?User $user): ?int
    {
        $target = $this->forUser($user);

        return $target?->id;
    }

    public function forUser(?User $user): ?Target
    {
        if ($user === null) {
            return null;
        }

        $email = strtolower(trim((string) $user->email));
        if ($email === '') {
            return null;
        }

        return Target::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('status', 'active')
            ->first();
    }

    /**
     * Block employee surfaces when a matching Target exists but is inactive.
     */
    public function assertEmployeeAccessAllowed(?User $user): void
    {
        if ($user === null) {
            return;
        }

        $email = strtolower(trim((string) $user->email));
        if ($email === '') {
            return;
        }

        $target = Target::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if ($target !== null && $target->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['This employee profile is inactive. Contact your administrator.'],
            ]);
        }
    }
}
