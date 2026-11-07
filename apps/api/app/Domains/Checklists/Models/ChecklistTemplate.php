<?php

namespace App\Domains\Checklists\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $name
 * @property string $slug
 * @property string $category
 * @property string|null $description
 * @property string $status
 * @property bool $is_system
 * @property int $current_version
 */
class ChecklistTemplate extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'category',
        'description',
        'status',
        'is_system',
        'current_version',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'current_version' => 'integer',
        ];
    }

    /** @return HasMany<ChecklistTemplateVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(ChecklistTemplateVersion::class, 'template_id');
    }

    /** @return HasMany<ChecklistInstance, $this> */
    public function instances(): HasMany
    {
        return $this->hasMany(ChecklistInstance::class, 'template_id');
    }

    public function latestVersion(): ?ChecklistTemplateVersion
    {
        return $this->versions()->where('version', $this->current_version)->first();
    }
}
