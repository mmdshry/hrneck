<?php

namespace App\Domains\IdentityAccess\Jobs;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Password;
use Stancl\Tenancy\Facades\Tenancy;

class SendEmployeeInviteJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $userId) {}

    public function handle(): void
    {
        $previousTenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        if ($previousTenantId !== null) {
            Tenancy::end();
        }

        try {
            $user = User::query()->find($this->userId);
            if ($user === null || $user->disabled_at !== null) {
                return;
            }

            if (! $user->must_set_password) {
                return;
            }

            try {
                Password::broker()->sendResetLink(['email' => $user->email]);
            } catch (\Throwable $e) {
                report($e);
            }
        } finally {
            if ($previousTenantId !== null) {
                $tenant = Tenant::query()->find($previousTenantId);
                if ($tenant) {
                    Tenancy::initialize($tenant);
                }
            }
        }
    }
}
