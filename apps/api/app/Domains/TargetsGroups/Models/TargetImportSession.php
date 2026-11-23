<?php

namespace App\Domains\TargetsGroups\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $disk_path
 * @property string $original_filename
 * @property list<string> $headers
 * @property list<array<string, string>> $sample_rows
 * @property int $row_count
 * @property int|null $created_by
 * @property Carbon $expires_at
 */
class TargetImportSession extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'disk_path',
        'original_filename',
        'headers',
        'sample_rows',
        'row_count',
        'created_by',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'headers' => 'array',
            'sample_rows' => 'array',
            'row_count' => 'integer',
            'created_by' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
