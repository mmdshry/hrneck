<?php

namespace App\Domains\Campaigns\Models;

use App\Domains\TrainingLms\Models\Course;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property-read Course|null $course
 */
class Campaign extends Model
{
    protected $fillable = [
        'name', 'type', 'status', 'course_id',
        'scheduled_at', 'starts_at', 'ends_at', 'randomize_send', 'meta',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'randomize_send' => 'boolean',
            'meta' => 'array',
        ];
    }

    /** @return BelongsTo<Course, $this> */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** @return HasMany<CampaignRecipient, $this> */
    public function recipients(): HasMany
    {
        return $this->hasMany(CampaignRecipient::class);
    }
}
