<?php

namespace App\Domains\TrainingLms\Models;

use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $course_id
 * @property int $target_id
 * @property string $status
 * @property int $progress
 * @property Carbon|null $opened_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $attested_at
 * @property bool $attestation_pending
 * @property string $source
 */
class Enrollment extends Model
{
    protected $fillable = [
        'course_id', 'target_id', 'status', 'progress', 'opened_at', 'completed_at', 'source',
        'attested_at', 'attestation_pending',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'completed_at' => 'datetime',
            'attested_at' => 'datetime',
            'attestation_pending' => 'boolean',
        ];
    }

    /** @return BelongsTo<Course, $this> */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** @return BelongsTo<Target, $this> */
    public function target(): BelongsTo
    {
        return $this->belongsTo(Target::class);
    }

    /** @return HasMany<LessonProgress, $this> */
    public function lessonProgress(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    /** @return HasMany<TrainingAssignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(TrainingAssignment::class);
    }
}
