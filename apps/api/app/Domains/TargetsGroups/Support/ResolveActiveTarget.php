<?php

namespace App\Domains\TargetsGroups\Support;

use App\Domains\TargetsGroups\Models\Target;
use App\Models\User;
use Illuminate\Support\Collection;
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

        if ($user->relationLoaded('linkedTarget')) {
            $linked = $user->getRelation('linkedTarget');

            return $linked instanceof Target ? $linked : null;
        }

        $byUserId = Target::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if ($byUserId !== null) {
            return $byUserId;
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
     * Batch-resolve active targets for a user collection (avoids N+1 in list serializers).
     *
     * @param  iterable<int, User>  $users
     * @return Collection<int, Target|null> keyed by user id
     */
    public function mapForUsers(iterable $users): Collection
    {
        $collection = Collection::make($users)->values();
        if ($collection->isEmpty()) {
            return collect();
        }

        $userIds = $collection->pluck('id')->map(fn ($id) => (int) $id)->all();
        $emails = $collection
            ->map(fn (User $user): string => strtolower(trim((string) $user->email)))
            ->filter(fn (string $email): bool => $email !== '')
            ->unique()
            ->values()
            ->all();

        $byUserId = Target::query()
            ->whereIn('user_id', $userIds)
            ->where('status', 'active')
            ->get()
            ->keyBy(fn (Target $target): int => (int) $target->user_id);

        $byEmail = $emails === []
            ? collect()
            : Target::query()
                ->where('status', 'active')
                ->where(function ($query) use ($emails): void {
                    foreach ($emails as $index => $email) {
                        if ($index === 0) {
                            $query->whereRaw('LOWER(email) = ?', [$email]);
                        } else {
                            $query->orWhereRaw('LOWER(email) = ?', [$email]);
                        }
                    }
                })
                ->get()
                ->keyBy(fn (Target $target): string => strtolower(trim((string) $target->email)));

        return $collection->mapWithKeys(function (User $user) use ($byUserId, $byEmail): array {
            $target = $byUserId->get((int) $user->id);
            if ($target === null) {
                $email = strtolower(trim((string) $user->email));
                $target = $email !== '' ? $byEmail->get($email) : null;
            }

            return [(int) $user->id => $target];
        });
    }

    /**
     * @param  iterable<int, User>  $users
     */
    public function attachLinkedTargets(iterable $users): void
    {
        $map = $this->mapForUsers($users);
        foreach ($users as $user) {
            $user->setRelation('linkedTarget', $map->get((int) $user->id));
        }
    }

    /**
     * Block employee surfaces when a matching Target exists but is inactive.
     */
    public function assertEmployeeAccessAllowed(?User $user): void
    {
        if ($user === null) {
            return;
        }

        $target = Target::query()
            ->where('user_id', $user->id)
            ->first();

        if ($target === null) {
            $email = strtolower(trim((string) $user->email));
            if ($email === '') {
                return;
            }

            $target = Target::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();
        }

        if ($target !== null && $target->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['This employee profile is inactive. Contact your administrator.'],
            ]);
        }
    }
}
