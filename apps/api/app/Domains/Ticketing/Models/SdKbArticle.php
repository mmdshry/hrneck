<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdKbArticle extends Model
{
    protected $table = 'sd_kb_articles';

    protected $fillable = [
        'desk_id',
        'number',
        'summary',
        'description',
        'category_id',
        'is_published',
        'source_ticket_id',
        'created_by',
        'updated_by',
        'locked_by',
        'locked_at',
        'custom_fields',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'category_id' => 'integer',
            'is_published' => 'boolean',
            'source_ticket_id' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'locked_by' => 'integer',
            'locked_at' => 'datetime',
            'custom_fields' => 'array',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }

    /** @return BelongsTo<SdCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(SdCategory::class, 'category_id');
    }
}
