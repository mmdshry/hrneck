<?php

namespace App\Domains\Notifications\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $type
 * @property string $title
 * @property string|null $body
 * @property array<string, mixed>|null $data
 * @property Carbon|null $read_at
 */
class UserNotification extends Model
{
    public const TYPE_TRAINING_ASSIGNED = 'training_assigned';

    public const TYPE_CHECKLIST_ASSIGNED = 'checklist_assigned';

    public const TYPE_TICKET_ASSIGNED = 'ticket_assigned';

    public const TYPE_ANNOUNCEMENT = 'announcement';

    protected $table = 'user_notifications';

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'data',
        'read_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
            'user_id' => 'integer',
        ];
    }
}
