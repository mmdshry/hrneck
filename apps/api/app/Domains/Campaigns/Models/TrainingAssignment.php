<?php

namespace App\Domains\Campaigns\Models;

use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One campaign send. Identity columns are frozen at send time so later
 * renames, group moves, and deletions do not rewrite a closed period.
 *
 * @property int|null $campaign_id
 * @property string $campaign_name
 * @property int|null $course_id
 * @property string $course_title
 * @property int|null $target_id
 * @property string $target_name
 * @property string $target_email
 * @property int|null $group_id
 * @property string $group_name
 * @property int|null $enrollment_id
 * @property int|null $recipient_id
 * @property bool $is_remedial
 * @property string $status
 * @property Carbon|null $sent_at
 */
class TrainingAssignment extends Model
{
    protected $fillable = [
        'campaign_id',
        'campaign_name',
        'course_id',
        'course_title',
        'target_id',
        'target_name',
        'target_email',
        'group_id',
        'group_name',
        'enrollment_id',
        'recipient_id',
        'is_remedial',
        'status',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'is_remedial' => 'boolean',
            'sent_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Campaign, $this> */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /** @return BelongsTo<Course, $this> */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** @return BelongsTo<Target, $this> */
    public function target(): BelongsTo
    {
        return $this->belongsTo(Target::class);
    }

    /** @return BelongsTo<Group, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /** @return BelongsTo<Enrollment, $this> */
    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    /** @return BelongsTo<CampaignRecipient, $this> */
    public function recipient(): BelongsTo
    {
        return $this->belongsTo(CampaignRecipient::class, 'recipient_id');
    }

    /** @return HasMany<TrainingAssignmentEvent, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(TrainingAssignmentEvent::class)->orderBy('occurred_at')->orderBy('id');
    }
}
