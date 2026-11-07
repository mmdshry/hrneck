<?php

namespace App\Domains\DirectorySync\Actions;

use App\Domains\DirectorySync\Drivers\DirectorySyncDriver;
use App\Domains\DirectorySync\Drivers\MockDirectorySyncDriver;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Support\Facades\DB;

class RunDirectorySync
{
    public function handle(?DirectorySyncDriver $driver = null): array
    {
        $driver ??= new MockDirectorySyncDriver;
        $payload = $driver->fetch();
        $syncedUsers = 0;
        $syncedGroups = 0;

        DB::transaction(function () use ($payload, &$syncedUsers, &$syncedGroups): void {
            $targetMap = [];
            foreach ($payload['users'] as $user) {
                $target = Target::query()->updateOrCreate(
                    ['external_id' => $user['external_id']],
                    [
                        'email' => $user['email'],
                        'first_name' => $user['first_name'] ?? null,
                        'last_name' => $user['last_name'] ?? null,
                        'status' => 'active',
                    ],
                );
                $targetMap[$user['external_id']] = $target->id;
                $syncedUsers++;
            }

            foreach ($payload['groups'] as $groupData) {
                $group = Group::query()->updateOrCreate(
                    ['external_id' => $groupData['external_id']],
                    [
                        'name' => $groupData['name'],
                        'source' => 'directory',
                    ],
                );
                $memberIds = collect($groupData['member_external_ids'])
                    ->map(fn (string $id) => $targetMap[$id] ?? null)
                    ->filter()
                    ->values()
                    ->all();
                $group->targets()->sync($memberIds);
                $syncedGroups++;
            }
        });

        return [
            'users' => $syncedUsers,
            'groups' => $syncedGroups,
        ];
    }
}
