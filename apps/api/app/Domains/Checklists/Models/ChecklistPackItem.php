<?php

namespace App\Domains\Checklists\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $pack_id
 * @property int $template_id
 * @property int $sort_order
 */
class ChecklistPackItem extends Model
{
    protected $fillable = [
        'pack_id',
        'template_id',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<ChecklistPack, $this> */
    public function pack(): BelongsTo
    {
        return $this->belongsTo(ChecklistPack::class, 'pack_id');
    }

    /** @return BelongsTo<ChecklistTemplate, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'template_id');
    }
}
