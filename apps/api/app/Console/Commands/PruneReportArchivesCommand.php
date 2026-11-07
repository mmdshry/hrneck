<?php

namespace App\Console\Commands;

use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

class PruneReportArchivesCommand extends Command
{
    protected $signature = 'hrneck:prune-report-archives {--days=180}';

    protected $description = 'Delete report archives older than retention window';

    public function handle(): int
    {
        $cutoff = now()->subDays((int) $this->option('days'));
        $pruned = 0;

        foreach (Tenant::query()->cursor() as $tenant) {
            Tenancy::initialize($tenant);
            $rows = ReportArchive::query()->where('generated_at', '<', $cutoff)->get();
            foreach ($rows as $row) {
                Storage::disk('local')->delete($row->disk_path);
                $row->delete();
                $pruned++;
            }
            Tenancy::end();
        }

        $this->info("Pruned {$pruned} report archive(s) older than ".$cutoff->toDateString());

        return self::SUCCESS;
    }
}
