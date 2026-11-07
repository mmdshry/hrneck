<?php

namespace App\Filament\Support;

use App\Domains\Audit\Actions\LogOrgActivity;
use Illuminate\Database\Eloquent\Model;

final class AuditsFilamentMutation
{
    /**
     * @param  array<string, mixed>  $properties
     */
    public static function log(
        string $logName,
        string $event,
        string $description,
        ?Model $subject = null,
        array $properties = [],
    ): void {
        app(LogOrgActivity::class)->handle(
            $logName,
            $event,
            $description,
            $subject,
            array_merge(['source' => 'filament'], $properties),
        );
    }
}
