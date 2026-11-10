<?php

namespace App\Domains\DirectorySync\Actions;

use App\Domains\DirectorySync\Drivers\DirectorySyncDriver;
use App\Domains\DirectorySync\Drivers\MockDirectorySyncDriver;
use App\Domains\IdentityAccess\Actions\ProvisionEmployeePair;
use App\Domains\IdentityAccess\Jobs\SendEmployeeInviteJob;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RunDirectorySync
{
    public function __construct(private readonly ProvisionEmployeePair $provision) {}

    public function handle(?DirectorySyncDriver $driver = null): array
    {
        $driver ??= new MockDirectorySyncDriver;
        $payload = $driver->fetch();
        $syncedUsers = 0;
        $syncedGroups = 0;
        $invited = 0;
        $loginSkipped = 0;
        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : '';
        $inviteUserIds = [];

        DB::transaction(function () use ($payload, &$syncedUsers, &$syncedGroups, &$loginSkipped, &$inviteUserIds, $tenantId): void {
            $targetMap = [];
            foreach ($payload['users'] as $user) {
                $email = $this->provision->normalizeEmail((string) $user['email']);
                $target = Target::query()->updateOrCreate(
                    ['external_id' => $user['external_id']],
                    [
                        'email' => $email,
                        'first_name' => $user['first_name'] ?? null,
                        'last_name' => $user['last_name'] ?? null,
                        'status' => 'active',
                    ],
                );
                $targetMap[$user['external_id']] = $target->id;
                $syncedUsers++;

                if ($tenantId === '') {
                    continue;
                }

                try {
                    $pair = $this->provision->ensureUserForTarget($target, $tenantId, queueInvite: false);
                    if ($pair['created']) {
                        $inviteUserIds[] = (int) $pair['user']->id;
                    }
                } catch (ValidationException) {
                    $loginSkipped++;
                }
            }

            foreach ($payload['groups'] as $groupData) {
                $group = Group::query()->updateOrCreate(
                    ['external_id' => $groupData['external_id']],
                    [
                        'name' => $groupData['name'],
                        'source' => 'directory',
                        'status' => 'active',
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

        foreach (array_values(array_unique($inviteUserIds)) as $userId) {
            SendEmployeeInviteJob::dispatch($userId);
            $invited++;
        }

        return [
            'users' => $syncedUsers,
            'groups' => $syncedGroups,
            'login_invited' => $invited,
            'login_skipped' => $loginSkipped,
        ];
    }
}
