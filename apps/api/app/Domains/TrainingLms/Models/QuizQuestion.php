<?php

namespace App\Domains\TrainingLms\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $quiz_id
 * @property string $prompt
 * @property array<int, string>|null $options
 * @property int $correct_index
 */
class QuizQuestion extends Model
{
    protected $fillable = ['quiz_id', 'prompt', 'options', 'correct_index'];

    protected function casts(): array
    {
        return ['options' => 'array'];
    }

    /** @return BelongsTo<Quiz, $this> */
    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }
}
