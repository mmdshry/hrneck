<?php

namespace App\Domains\Ticketing\Jobs;

use App\Domains\Ticketing\Actions\ApplySlaGoals;
use App\Domains\Ticketing\Actions\ProcessEscalations;
use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Stancl\Tenancy\Facades\Tenancy;

class ProcessTicketEscalationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(ProcessEscalations $escalations, ApplySlaGoals $sla): void
    {
        foreach (Tenant::query()->cursor() as $tenant) {
            Tenancy::initialize($tenant);
            $escalations->handle();
            $sla->evaluateBreaches();
            Tenancy::end();
        }
    }
}
