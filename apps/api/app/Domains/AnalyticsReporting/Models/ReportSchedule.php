<?php

namespace App\Domains\AnalyticsReporting\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $name
 * @property string $cadence
 * @property string $format
 * @property string $recipient_email
 */
class ReportSchedule extends Model
{
    protected $fillable = [
        'name', 'cadence', 'format', 'recipient_email', 'next_run_at', 'last_run_at',
    ];

    protected function casts(): array
    {
        return [
            'next_run_at' => 'datetime',
            'last_run_at' => 'datetime',
        ];
    }
}
