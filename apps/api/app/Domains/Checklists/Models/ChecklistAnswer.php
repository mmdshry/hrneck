<?php

namespace App\Domains\Checklists\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $instance_id
 * @property string $item_key
 * @property mixed $value_json
 * @property string|null $file_disk_path
 * @property string|null $file_mime
 * @property int|null $file_size
 * @property int|null $updated_by
 */
class ChecklistAnswer extends Model
{
    protected $fillable = [
        'instance_id',
        'item_key',
        'value_json',
        'file_disk_path',
        'file_mime',
        'file_size',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'value_json' => 'array',
        ];
    }

    /** @return BelongsTo<ChecklistInstance, $this> */
    public function instance(): BelongsTo
    {
        return $this->belongsTo(ChecklistInstance::class, 'instance_id');
    }

    public function decodedValue(): mixed
    {
        $value = $this->value_json;
        if (is_array($value) && array_key_exists('value', $value) && count($value) === 1) {
            return $value['value'];
        }

        return $value;
    }
}
