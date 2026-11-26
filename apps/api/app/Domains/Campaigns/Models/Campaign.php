<?php

namespace App\Domains\Campaigns\Models;

use App\Domains\TrainingLms\Models\Course;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property-read Collection<int, Course> $courses Ordered by the pivot sort_order.
 * @property Carbon|null $starts_at
 * @property Carbon|null $expires_at
 * @property array{target_ids?: list<int>, group_ids?: list<int>}|null $launch_audience
 */
class Campaign extends Model
{
    protected $fillable = [
        'name', 'type', 'status', 'is_remedial',
        'scheduled_at', 'starts_at', 'expires_at', 'ends_at', 'launch_audience',
    ];

    /** @var list<string> */
    protected $hidden = ['launch_audience'];

    protected function casts(): array
    {
        return [
            'is_remedial' => 'boolean',
            'scheduled_at' => 'datetime',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'ends_at' => 'datetime',
            'launch_audience' => 'array',
        ];
    }

    /** @return BelongsToMany<Course, $this> */
    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'campaign_course')
            ->withPivot('sort_order')
            ->orderBy('campaign_course.sort_order')
            ->orderBy('courses.id');
    }

    /** @return HasMany<CampaignRecipient, $this> */
    public function recipients(): HasMany
    {
        return $this->hasMany(CampaignRecipient::class);
    }

    public function isUpcomingAt(CarbonInterface $at): bool
    {
        return ! $this->isClosed()
            && $this->starts_at !== null
            && $this->starts_at->greaterThan($at);
    }

    public function isExpiredAt(CarbonInterface $at): bool
    {
        return $this->expires_at !== null && $this->expires_at->lessThanOrEqualTo($at);
    }

    /** Learners may work on this campaign only between its start and its expiration. */
    public function isAccessibleAt(CarbonInterface $at): bool
    {
        return ! $this->isClosed()
            && ! $this->isUpcomingAt($at)
            && ! $this->isExpiredAt($at);
    }

    /**
     * The audience captured when a training campaign was held until its start time.
     *
     * @return array{target_ids: list<int>, group_ids: list<int>}|null
     */
    public function launchAudience(): ?array
    {
        $audience = $this->launch_audience;
        if (! is_array($audience)) {
            return null;
        }

        return [
            'target_ids' => array_map(intval(...), $audience['target_ids'] ?? []),
            'group_ids' => array_map(intval(...), $audience['group_ids'] ?? []),
        ];
    }

    private function isClosed(): bool
    {
        return in_array($this->status, ['cancelled', 'archived'], true);
    }
}
