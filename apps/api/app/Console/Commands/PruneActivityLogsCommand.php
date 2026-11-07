<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;
use Spatie\Activitylog\Support\Config;
use Stancl\Tenancy\Facades\Tenancy;

class PruneActivityLogsCommand extends Command
{
    protected $signature = 'hrneck:prune-activity-logs {--days=180}';

    protected $description = 'Prune Spatie activity_log rows older than N days in every tenant database';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 1) {
            $this->error('The days option must be a positive integer.');

            return self::FAILURE;
        }

        $total = 0;
        foreach (Tenant::query()->cursor() as $tenant) {
            Tenancy::initialize($tenant);
            $deleted = Config::cleanActivityLogAction()->execute($days);
            $total += $deleted;
            Tenancy::end();
        }

        $this->info("Deleted {$total} activity log record(s) across tenants (older than {$days} days).");

        return self::SUCCESS;
    }
}
