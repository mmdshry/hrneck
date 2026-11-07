<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Support\LoadTestMarkers;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Facades\Tenancy;

class PurgeLoadTestCommand extends Command
{
    protected $signature = 'hrneck:purge-load-test
        {--force : Actually delete load-test tenants and marked rows}';

    protected $description = 'Dry-run or purge load-test tenants/targets (loadtest- markers)';

    public function handle(): int
    {
        $force = (bool) $this->option('force');
        $loadTenants = Tenant::query()
            ->where('id', 'like', LoadTestMarkers::TENANT_PREFIX.'%')
            ->orderBy('id')
            ->get();

        $this->info($force ? 'Purging load-test data…' : 'Dry-run (pass --force to delete)…');
        $this->line('Load-test tenants found: '.$loadTenants->count());

        foreach ($loadTenants as $tenant) {
            $db = LoadTestMarkers::databaseName($tenant->id);
            $this->line(($force ? 'DROP ' : 'would drop ').$db.' + tenant '.$tenant->id);
            if ($force) {
                DB::statement("DROP DATABASE IF EXISTS `{$db}`");
                DB::table('domains')->where('tenant_id', $tenant->id)->delete();
                DB::table('tenants')->where('id', $tenant->id)->delete();
            }
        }

        $remaining = Tenant::query()
            ->where('id', 'not like', LoadTestMarkers::TENANT_PREFIX.'%')
            ->orderBy('id')
            ->get();

        foreach ($remaining as $tenant) {
            Tenancy::initialize($tenant);
            $targets = DB::table('targets')
                ->where(function ($q): void {
                    $q->where('external_id', 'like', LoadTestMarkers::EXTERNAL_ID_PREFIX.'%')
                        ->orWhere('email', 'like', '%@'.LoadTestMarkers::EMAIL_DOMAIN);
                })
                ->count();
            $groups = DB::table('groups')
                ->where(function ($q): void {
                    $q->where('external_id', 'like', LoadTestMarkers::GROUP_PREFIX.'%')
                        ->orWhere('name', 'like', LoadTestMarkers::GROUP_PREFIX.'%')
                        ->orWhere('source', 'loadtest');
                })
                ->count();
            $this->line(($force ? 'clean ' : 'would clean ').$tenant->id.": {$targets} targets, {$groups} groups");

            if ($force && ($targets > 0 || $groups > 0)) {
                $targetIds = DB::table('targets')
                    ->where(function ($q): void {
                        $q->where('external_id', 'like', LoadTestMarkers::EXTERNAL_ID_PREFIX.'%')
                            ->orWhere('email', 'like', '%@'.LoadTestMarkers::EMAIL_DOMAIN);
                    })
                    ->pluck('id');
                if ($targetIds->isNotEmpty()) {
                    DB::table('group_target')->whereIn('target_id', $targetIds)->delete();
                    DB::table('targets')->whereIn('id', $targetIds)->delete();
                }
                $groupIds = DB::table('groups')
                    ->where(function ($q): void {
                        $q->where('external_id', 'like', LoadTestMarkers::GROUP_PREFIX.'%')
                            ->orWhere('name', 'like', LoadTestMarkers::GROUP_PREFIX.'%')
                            ->orWhere('source', 'loadtest');
                    })
                    ->pluck('id');
                if ($groupIds->isNotEmpty()) {
                    DB::table('group_target')->whereIn('group_id', $groupIds)->delete();
                    DB::table('groups')->whereIn('id', $groupIds)->delete();
                }
            }
            Tenancy::end();
        }

        $this->info($force ? 'Purge complete.' : 'Dry-run complete. Re-run with --force to delete.');

        return self::SUCCESS;
    }
}
