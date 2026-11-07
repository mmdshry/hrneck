<?php

namespace App\Domains\Audit\Actions;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Models\Activity;

class LogOrgActivity
{
    /**
     * @param  array<string, mixed>  $properties
     */
    public function handle(
        string $logName,
        string $event,
        string $description,
        ?Model $subject = null,
        array $properties = [],
        ?int $causerId = null,
    ): Activity {
        $causer = null;
        if ($causerId !== null) {
            $causer = User::query()->find($causerId);
        } elseif (auth()->check()) {
            $causer = auth()->user();
        }

        if ($causer instanceof User) {
            $properties = array_merge([
                'causer_email' => $causer->email,
                'causer_name' => $causer->name,
            ], $properties);
        }

        $logger = activity($logName)
            ->event($event)
            ->withProperties($properties);

        if ($subject !== null) {
            $logger->performedOn($subject);
        }

        if ($causer !== null) {
            $logger->causedBy($causer);
        } else {
            $logger->causedByAnonymous();
        }

        return $logger->log($description);
    }
}
