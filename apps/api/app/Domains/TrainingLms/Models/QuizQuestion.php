<?php

namespace App\Domains\TrainingLms\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $quiz_id
 * @property string $type
 * @property string $prompt
 * @property array<int, string>|null $options
 * @property int|null $correct_index
 */
class QuizQuestion extends Model
{
    public const TYPE_MCQ = 'mcq';

    public const TYPE_ESSAY = 'essay';

    protected $fillable = ['quiz_id', 'type', 'prompt', 'options', 'correct_index'];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'correct_index' => 'integer',
        ];
    }

    /** @return BelongsTo<Quiz, $this> */
    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function isEssay(): bool
    {
        return $this->type === self::TYPE_ESSAY;
    }

    public function isMcq(): bool
    {
        return $this->type !== self::TYPE_ESSAY;
    }
}
