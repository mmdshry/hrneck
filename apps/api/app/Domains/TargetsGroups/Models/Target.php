<?php

namespace App\Domains\TargetsGroups\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property string $email
 * @property string|null $first_name
 * @property string|null $last_name
 * @property string|null $department
 * @property int|null $department_id
 * @property string $status
 * @property string|null $external_id
 * @property int $risk_score
 */
class Target extends Model
{
    protected $fillable = [
        'email',
        'first_name',
        'last_name',
        'department',
        'department_id',
        'status',
        'external_id',
        'risk_score',
    ];

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
}
