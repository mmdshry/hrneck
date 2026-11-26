<?php

namespace App\Domains\TargetsGroups\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * @property string $email
 * @property string|null $first_name
 * @property string|null $last_name
 * @property string|null $department
 * @property int|null $department_id
 * @property string|null $job_title
 * @property int|null $manager_target_id
 * @property Carbon|null $hire_date
 * @property string|null $employee_number
 * @property string|null $phone
 * @property string|null $location
 * @property string|null $employment_type
 * @property int|null $user_id
 * @property string|null $preferred_language
 * @property string $status
 * @property string|null $external_id
 * @property string|null $avatar_path
 * @property int $risk_score
 * @property string $risk_tier
 * @property string|null $risk_source
 * @property Carbon|null $last_training_completed_at
 * @property bool $notification_opt_out
 * @property string|null $joined_via
 */
class Target extends Model
{
    protected $appends = [
        'avatar_url',
    ];

    protected $fillable = [
        'email',
        'first_name',
        'last_name',
        'department',
        'department_id',
        'job_title',
        'manager_target_id',
        'hire_date',
        'employee_number',
        'phone',
        'location',
        'employment_type',
        'user_id',
        'preferred_language',
        'status',
        'external_id',
        'avatar_path',
        'risk_score',
        'risk_tier',
        'risk_updated_at',
        'risk_source',
        'last_training_completed_at',
        'notification_opt_out',
        'joined_via',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'risk_score' => 'integer',
            'risk_updated_at' => 'datetime',
            'last_training_completed_at' => 'datetime',
            'notification_opt_out' => 'boolean',
            'manager_target_id' => 'integer',
            'department_id' => 'integer',
            'user_id' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Target $target): void {
            if (! $target->isDirty('department_id')) {
                return;
            }

            if ($target->department_id === null) {
                $target->department = null;

                return;
            }

            $name = Department::query()->whereKey($target->department_id)->value('name');
            $target->department = is_string($name) ? $name : null;
        });
    }

    /** @return BelongsToMany<Group, $this> */
    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class);
    }

    /** @return BelongsTo<Department, $this> */
    public function departmentRecord(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** @return BelongsTo<Target, $this> */
    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_target_id');
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (! filled($this->avatar_path) || $this->getKey() === null) {
            return null;
        }

        return '/api/v1/org/targets/'.$this->id.'/avatar';
    }
}
