<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Support\LoadTestMarkers;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Facades\Tenancy;

class SeedLoadTestCommand extends Command
{
    protected $signature = 'hrneck:seed-load-test
        {--orgs=50 : Number of loadtest tenant organizations}
        {--per-org=500 : Targets per loadtest organization}
        {--itneck-targets=50000 : Extra targets inside itneck}
        {--chunk=500 : Bulk insert chunk size}';

    protected $description = 'Seed load-test tenants/targets (prefixed loadtest-; local use only)';

    /** @var list<string> */
    private array $industries = [
        'Technology', 'Healthcare', 'Education', 'Finance', 'Retail',
        'Manufacturing', 'Logistics', 'Energy', 'Media', 'Government',
    ];

    /** @var list<string> */
    private array $bands = ['1-10', '11-50', '51-200', '201-500', '500+'];

    /** @var list<string> */
    private array $departments = [
        'Engineering', 'Sales', 'HR', 'Finance', 'Support', 'Marketing', 'Operations', 'Legal',
    ];

    /** @var list<string> */
    private array $firstNames = [
        'Alex', 'Jordan', 'Sam', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Avery', 'Jamie',
        'Cameron', 'Drew', 'Harper', 'Reese', 'Skyler', 'Parker', 'Rowan', 'Elliot', 'Finley', 'Blake',
    ];

    /** @var list<string> */
    private array $lastNames = [
        'Rivera', 'Lee', 'Nguyen', 'Patel', 'Garcia', 'Kim', 'Brown', 'Silva', 'Novak', 'Cohen',
        'Anders', 'Berg', 'Costa', 'Dubois', 'Evans', 'Foster', 'Green', 'Hayes', 'Ibrahim', 'Jones',
    ];

    public function handle(): int
    {
        $orgs = max(0, (int) $this->option('orgs'));
        $perOrg = max(0, (int) $this->option('per-org'));
        $itneckTargets = max(0, (int) $this->option('itneck-targets'));
        $chunk = max(50, (int) $this->option('chunk'));

        $this->warn('Load-test seed creates extra tenant databases. Local testing only.');
        $this->line("orgs={$orgs} per-org={$perOrg} itneck-targets={$itneckTargets} chunk={$chunk}");

        $base = (string) config('brand.tenancy_base_domain', 'hrneck.test');
        $bar = $this->output->createProgressBar($orgs + ($itneckTargets > 0 ? 1 : 0));
        $bar->start();

        for ($i = 1; $i <= $orgs; $i++) {
            $slug = LoadTestMarkers::tenantId($i);
            $this->ensureTenant($slug, $i, $base);
            Artisan::call('tenants:migrate', ['--tenants' => [$slug], '--force' => true]);
            Tenancy::initialize(Tenant::query()->findOrFail($slug));
            $this->seedTargetsAndGroups($slug, $perOrg, $chunk, 'u'.$i);
            Tenancy::end();
            $bar->advance();
        }

        if ($itneckTargets > 0) {
            $itneck = Tenant::query()->find('itneck');
            if (! $itneck) {
                $this->error('Tenant itneck not found — run DemoSeeder first.');
                $bar->finish();
                $this->newLine();

                return self::FAILURE;
            }
            Tenancy::initialize($itneck);
            $this->seedTargetsAndGroups('itneck', $itneckTargets, $chunk, 'u-itneck');
            Tenancy::end();
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info('Load-test seed complete.');
        $this->line('Purge later with: php artisan hrneck:purge-load-test --force');

        return self::SUCCESS;
    }

    private function ensureTenant(string $slug, int $index, string $base): void
    {
        $dbName = LoadTestMarkers::databaseName($slug);
        $exists = DB::table('tenants')->where('id', $slug)->exists();
        if (! $exists) {
            DB::table('tenants')->insert([
                'id' => $slug,
                'name' => 'Load Test Org '.$index,
                'industry' => $this->industries[($index - 1) % count($this->industries)],
                'employee_band' => $this->bands[($index - 1) % count($this->bands)],
                'status' => $index % 7 === 0 ? 'inactive' : 'active',
                'training_enabled' => $index % 4 !== 0,
                'data' => json_encode(['tenancy_db_name' => $dbName], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('domains')->insert([
                'domain' => $slug.'.'.$base,
                'tenant_id' => $slug,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::statement("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }

    private function seedTargetsAndGroups(string $tenantKey, int $count, int $chunk, string $emailPrefix): void
    {
        if ($count <= 0) {
            return;
        }

        $existingIds = DB::table('targets')
            ->where(function ($q): void {
                $q->where('external_id', 'like', LoadTestMarkers::EXTERNAL_ID_PREFIX.'%')
                    ->orWhere('email', 'like', '%@'.LoadTestMarkers::EMAIL_DOMAIN);
            })
            ->pluck('id');
        if ($existingIds->isNotEmpty()) {
            DB::table('group_target')->whereIn('target_id', $existingIds)->delete();
            DB::table('targets')->whereIn('id', $existingIds)->delete();
        }
        $groupIds = DB::table('groups')
            ->where(function ($q): void {
                $q->where('external_id', 'like', LoadTestMarkers::GROUP_PREFIX.'%')
                    ->orWhere('source', 'loadtest');
            })
            ->pluck('id');
        if ($groupIds->isNotEmpty()) {
            DB::table('group_target')->whereIn('group_id', $groupIds)->delete();
            DB::table('groups')->whereIn('id', $groupIds)->delete();
        }

        $now = now()->toDateTimeString();
        $rows = [];
        for ($n = 1; $n <= $count; $n++) {
            $dept = $this->departments[($n - 1) % count($this->departments)];
            $rows[] = [
                'email' => LoadTestMarkers::targetEmail($emailPrefix.'-'.$n),
                'first_name' => $this->firstNames[($n - 1) % count($this->firstNames)],
                'last_name' => $this->lastNames[($n + 3) % count($this->lastNames)],
                'department' => $dept,
                'status' => $n % 17 === 0 ? 'inactive' : 'active',
                'external_id' => LoadTestMarkers::targetExternalId($tenantKey, $n),
                'risk_score' => ($n * 7) % 101,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            if (count($rows) >= $chunk) {
                DB::table('targets')->upsert($rows, ['email'], [
                    'first_name', 'last_name', 'department', 'status', 'external_id', 'risk_score', 'updated_at',
                ]);
                $rows = [];
            }
        }
        if ($rows !== []) {
            DB::table('targets')->upsert($rows, ['email'], [
                'first_name', 'last_name', 'department', 'status', 'external_id', 'risk_score', 'updated_at',
            ]);
        }

        foreach ($this->departments as $dept) {
            $ext = LoadTestMarkers::groupExternalId($dept);
            $groupId = DB::table('groups')->where('external_id', $ext)->value('id');
            if (! $groupId) {
                $groupId = DB::table('groups')->insertGetId([
                    'name' => LoadTestMarkers::GROUP_PREFIX.'dept-'.$dept,
                    'source' => 'loadtest',
                    'external_id' => $ext,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $targetIds = DB::table('targets')
                ->where('department', $dept)
                ->where('external_id', 'like', LoadTestMarkers::EXTERNAL_ID_PREFIX.'%')
                ->limit(100)
                ->pluck('id');

            $pivots = [];
            foreach ($targetIds as $targetId) {
                $pivots[] = [
                    'group_id' => $groupId,
                    'target_id' => $targetId,
                ];
            }
            if ($pivots !== []) {
                DB::table('group_target')->upsert($pivots, ['group_id', 'target_id']);
            }
        }
    }
}
