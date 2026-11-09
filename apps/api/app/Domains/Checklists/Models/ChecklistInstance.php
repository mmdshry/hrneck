<?php

namespace App\Domains\Checklists\Models;

use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $template_id
 * @property int $template_version_id
 * @property int $target_id
 * @property string $title
 * @property string $status
 * @property array $schema_snapshot
 * @property int $progress_pct
 * @property Carbon|null $started_at
 * @property Carbon|null $completed_at
 * @property int|null $assigned_by
 */
class ChecklistInstance extends Model
{
    public const STATUS_NOT_STARTED = 'not_started';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'template_id',
        'template_version_id',
        'target_id',
        'title',
        'status',
        'schema_snapshot',
        'progress_pct',
        'started_at',
        'completed_at',
        'assigned_by',
    ];

    protected function casts(): array
    {
        return [
            'schema_snapshot' => 'array',
            'progress_pct' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function isOpen(): bool
    {
        return in_array($this->status, [self::STATUS_NOT_STARTED, self::STATUS_IN_PROGRESS], true);
    }

    /** @return BelongsTo<ChecklistTemplate, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'template_id');
    }

    /** @return BelongsTo<ChecklistTemplateVersion, $this> */
    public function templateVersion(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplateVersion::class, 'template_version_id');
    }

    /** @return BelongsTo<Target, $this> */
    public function target(): BelongsTo
    {
        return $this->belongsTo(Target::class);
    }

    /** @return HasMany<ChecklistAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(ChecklistAnswer::class, 'instance_id');
    }
}
