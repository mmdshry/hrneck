<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Before per-organization accounts, one login could belong to several organizations.
 * This gives every extra organization its own login: a copy of the account (same password hash and
 * MFA settings), the membership, the roles for that organization, and the references to it inside that
 * organization's database. The original login stays with its primary organization.
 */
class SplitSharedAccounts extends Command
{
    /** Tenant-database columns that point at a central user id. */
    private const TENANT_USER_COLUMNS = ['user_id', 'requester_user_id', 'assignee_user_id', 'author_user_id'];

    protected $signature = 'users:split-shared-accounts {--dry-run : Report what would change without writing anything}';

    protected $description = 'Give each organization its own login for accounts that belong to several organizations.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $shared = User::query()
            ->has('memberships', '>', 1)
            ->with('memberships')
            ->orderBy('id')
            ->get();

        if ($shared->isEmpty()) {
            $this->info('No shared logins found.');

            return self::SUCCESS;
        }

        $split = 0;
        foreach ($shared as $user) {
            /** @var Collection<int, TenantMembership> $memberships */
            $memberships = $user->memberships->sortBy('id')->values();
            $primaryTenant = $this->primaryTenant($user, $memberships);

            foreach ($memberships as $membership) {
                if ($membership->tenant_id === $primaryTenant) {
                    continue;
                }

                if ($this->splitMembership($user, $membership, $dryRun)) {
                    $split++;
                }
            }

            if (! $dryRun && $user->tenant_id !== $primaryTenant) {
                $user->forceFill(['tenant_id' => $primaryTenant])->save();
            }
        }

        if (! $dryRun) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }

        $this->info(($dryRun ? 'Would create ' : 'Created ')."{$split} organization login(s) from {$shared->count()} shared account(s).");

        return self::SUCCESS;
    }

    /**
     * @param  Collection<int, TenantMembership>  $memberships
     */
    private function primaryTenant(User $user, $memberships): string
    {
        if ($user->tenant_id !== null && $memberships->contains('tenant_id', $user->tenant_id)) {
            return (string) $user->tenant_id;
        }

        return (string) $memberships->first()->tenant_id;
    }

    private function splitMembership(User $user, TenantMembership $membership, bool $dryRun): bool
    {
        $tenantId = (string) $membership->tenant_id;

        $clash = User::query()
            ->withEmail((string) $user->email)
            ->where('tenant_id', $tenantId)
            ->exists();

        if ($clash) {
            $this->warn("Skipped user #{$user->id} for [{$tenantId}]: that organization already has a login with this email.");

            return false;
        }

        if ($dryRun) {
            $this->line("[dry-run] user #{$user->id} ({$user->email}) -> new login for [{$tenantId}]");

            return true;
        }

        $newUserId = DB::transaction(function () use ($user, $membership, $tenantId): int {
            $attributes = Arr::except($user->getAttributes(), ['id', 'platform_email', 'remember_token']);
            $now = now();
            $attributes = array_merge($attributes, [
                'tenant_id' => $tenantId,
                'department_id' => $membership->department_id,
                'department' => $membership->department,
                'disabled_at' => $membership->disabled_at,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $newUserId = (int) DB::table('users')->insertGetId($attributes);

            DB::table('tenant_memberships')
                ->where('id', $membership->id)
                ->update(['user_id' => $newUserId]);

            foreach (['model_has_roles', 'model_has_permissions'] as $pivot) {
                DB::table($pivot)
                    ->where('model_type', User::class)
                    ->where('model_id', $user->id)
                    ->where('tenant_id', $tenantId)
                    ->update(['model_id' => $newUserId]);
            }

            return $newUserId;
        });

        $this->rewriteTenantReferences($tenantId, (int) $user->id, $newUserId);

        $this->line("Split user #{$user->id} ({$user->email}) -> user #{$newUserId} for [{$tenantId}]");

        return true;
    }

    private function rewriteTenantReferences(string $tenantId, int $oldUserId, int $newUserId): void
    {
        $tenant = Tenant::query()->find($tenantId);
        if ($tenant === null) {
            return;
        }

        $tenant->run(function () use ($oldUserId, $newUserId): void {
            $columns = DB::select(
                'SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.COLUMNS '
                .'WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('
                .implode(',', array_fill(0, count(self::TENANT_USER_COLUMNS), '?')).')',
                self::TENANT_USER_COLUMNS,
            );

            foreach ($columns as $column) {
                DB::table($column->table_name)
                    ->where($column->column_name, $oldUserId)
                    ->update([$column->column_name => $newUserId]);
            }
        });
    }
}
