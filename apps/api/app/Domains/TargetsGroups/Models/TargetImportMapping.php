<?php

namespace App\Domains\TargetsGroups\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property array<string, string|null> $column_map
 */
class TargetImportMapping extends Model
{
    protected $fillable = [
        'name',
        'column_map',
    ];

    protected function casts(): array
    {
        return [
            'column_map' => 'array',
        ];
    }
}
