<?php

namespace App\Domains\AnalyticsReporting\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $name
 * @property string $scope
 * @property string $period_type
 * @property string $period_key
 * @property string $format
 * @property string $disk_path
 * @property string $status
 */
class ReportArchive extends Model
{
    protected $fillable = [
        'name', 'scope', 'period_type', 'period_key', 'format', 'disk_path',
        'timezone', 'options', 'status', 'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'generated_at' => 'datetime',
        ];
    }
}
