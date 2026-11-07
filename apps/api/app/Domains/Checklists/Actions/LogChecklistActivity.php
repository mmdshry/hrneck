<?php

namespace App\Domains\Checklists\Actions;

use App\Domains\Audit\Actions\LogOrgActivity;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Models\Activity;

class LogChecklistActivity
{
    public function __construct(private LogOrgActivity $audit) {}

    /**
     * @param  array<string, mixed>  $properties
     */
    public function handle(
        string $event,
        string $description,
        ?Model $subject = null,
        array $properties = [],
        ?int $causerId = null,
    ): Activity {
        return $this->audit->handle(
            'checklists',
            $event,
            $description,
            $subject,
            $properties,
            $causerId,
        );
    }
}
