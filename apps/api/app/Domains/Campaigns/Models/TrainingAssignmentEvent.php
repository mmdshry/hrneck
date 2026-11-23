<?php

namespace App\Domains\Campaigns\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Immutable outcome for one assignment. A later pass does not delete an earlier fail.
 *
 * @property int $training_assignment_id
 * @property string $type
 * @property Carbon $occurred_at
 */
class TrainingAssignmentEvent extends Model
{
    public const SENT = 'sent';

    public const STARTED = 'started';

    public const FAILED = 'failed';

    public const PASSED = 'passed';

    /** @var list<string> */
    public const TYPES = [
        self::SENT,
        self::STARTED,
        self::FAILED,
        self::PASSED,
    ];

    /** Higher rank wins when two events share a timestamp. */
    public const RANK = [
        self::SENT => 1,
        self::STARTED => 2,
        self::FAILED => 3,
        self::PASSED => 4,
    ];

    public $timestamps = false;

    protected $fillable = [
        'training_assignment_id',
        'type',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<TrainingAssignment, $this> */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(TrainingAssignment::class, 'training_assignment_id');
    }
}
