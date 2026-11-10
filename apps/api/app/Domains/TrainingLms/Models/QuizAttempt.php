<?php

namespace App\Domains\TrainingLms\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    protected $fillable = [
        'quiz_id', 'target_id', 'score', 'passed', 'answers', 'started_at',
    ];

    protected function casts(): array
    {
        return [
            'passed' => 'boolean',
            'answers' => 'array',
            'started_at' => 'datetime',
        ];
    }
}
