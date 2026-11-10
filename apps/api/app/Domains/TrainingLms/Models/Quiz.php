<?php

namespace App\Domains\TrainingLms\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $course_id
 * @property string $title
 * @property int $pass_score
 * @property bool $is_required
 * @property int|null $time_limit_seconds
 * @property int $sort_order
 * @property-read Collection<int, QuizQuestion> $questions
 */
class Quiz extends Model
{
    protected $fillable = [
        'course_id',
        'title',
        'pass_score',
        'is_required',
        'time_limit_seconds',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'time_limit_seconds' => 'integer',
            'sort_order' => 'integer',
            'pass_score' => 'integer',
        ];
    }

    /** @return BelongsTo<Course, $this> */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** @return HasMany<QuizQuestion, $this> */
    public function questions(): HasMany
    {
        return $this->hasMany(QuizQuestion::class)->orderBy('id');
    }
}
