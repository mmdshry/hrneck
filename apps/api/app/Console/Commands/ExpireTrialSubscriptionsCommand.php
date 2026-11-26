<?php

namespace App\Console\Commands;

use App\Domains\Subscriptions\Actions\ExpireLapsedTrials;
use Illuminate\Console\Command;

class ExpireTrialSubscriptionsCommand extends Command
{
    protected $signature = 'hrneck:expire-trial-subscriptions';

    protected $description = 'Move trial subscriptions whose end date has passed to expired (read-only)';

    public function handle(ExpireLapsedTrials $expirer): int
    {
        $count = $expirer->handle(now());

        $this->info("Expired {$count} lapsed trial subscription(s).");

        return self::SUCCESS;
    }
}
