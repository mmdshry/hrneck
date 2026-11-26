<?php

namespace App\Domains\TrainingLms\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Append-only record of a learner accepting the course completion attestation.
 *
 * @property int $enrollment_id
 * @property int $course_id
 * @property int $target_id
 * @property string $text_version
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property Carbon $accepted_at
 */
class TrainingAttestation extends Model
{
    /** Bump when the attestation wording changes; stored with every acceptance. */
    public const TEXT_VERSION = 'v1';

    protected $fillable = [
        'enrollment_id',
        'course_id',
        'target_id',
        'text_version',
        'ip_address',
        'user_agent',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return [
            'accepted_at' => 'datetime',
        ];
    }
}
