<?php

namespace App\Domains\TargetsGroups\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property string $email
 * @property string|null $first_name
 * @property string|null $last_name
 * @property string|null $department
 * @property string $status
 * @property string|null $external_id
 * @property int $risk_score
 */
class Target extends Model
{
    protected $fillable = [
        'email', 'first_name', 'last_name', 'department', 'status', 'external_id', 'risk_score',
    ];

    /** @return BelongsToMany<Group, $this> */
    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class);
    }
}
