<?php

namespace App\Domains\Checklists\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $template_id
 * @property int $version
 * @property array $schema_json
 * @property int|null $created_by
 */
class ChecklistTemplateVersion extends Model
{
    protected $fillable = [
        'template_id',
        'version',
        'schema_json',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'schema_json' => 'array',
            'version' => 'integer',
        ];
    }

    /** @return BelongsTo<ChecklistTemplate, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'template_id');
    }

    /** @return HasMany<ChecklistInstance, $this> */
    public function instances(): HasMany
    {
        return $this->hasMany(ChecklistInstance::class, 'template_version_id');
    }
}
