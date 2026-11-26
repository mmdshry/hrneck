<?php

namespace App\Domains\Assistant\Models;

use App\Domains\Assistant\Support\AssistantPendingActionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A write action proposed by the assistant. It runs only after the user confirms it in HRneck.
 *
 * @property int $id
 * @property string $conversation_id
 * @property int $user_id
 * @property string $tool
 * @property array<string, mixed> $input
 * @property string $summary
 * @property AssistantPendingActionStatus $status
 * @property array<string, mixed>|null $result
 * @property string|null $failure_reason
 * @property Carbon $expires_at
 * @property Carbon|null $resolved_at
 */
#[Fillable([
    'conversation_id',
    'user_id',
    'tool',
    'input',
    'summary',
    'status',
    'result',
    'failure_reason',
    'expires_at',
    'resolved_at',
])]
class AssistantPendingAction extends Model
{
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'input' => 'array',
            'result' => 'array',
            'status' => AssistantPendingActionStatus::class,
            'expires_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }
}
