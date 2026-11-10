<?php

namespace App\Domains\Checklists\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property string $status
 * @property bool $auto_assign_on_create
 */
class ChecklistPack extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'status',
        'auto_assign_on_create',
    ];

    protected function casts(): array
    {
        return [
            'auto_assign_on_create' => 'boolean',
        ];
    }

    /** @return HasMany<ChecklistPackItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(ChecklistPackItem::class, 'pack_id')->orderBy('sort_order');
    }
}
