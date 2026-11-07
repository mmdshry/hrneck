<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $name
 * @property string $slug
 * @property string $type
 * @property string $number_prefix
 * @property int $next_number
 * @property bool $is_active
 * @property bool $is_system
 * @property array<string, mixed>|null $settings
 */
class SdDesk extends Model
{
    protected $table = 'sd_desks';

    protected $fillable = [
        'name',
        'slug',
        'type',
        'number_prefix',
        'next_number',
        'is_active',
        'is_system',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'next_number' => 'integer',
            'is_active' => 'boolean',
            'is_system' => 'boolean',
            'settings' => 'array',
        ];
    }

    /** @return HasMany<SdStage, $this> */
    public function stages(): HasMany
    {
        return $this->hasMany(SdStage::class, 'desk_id')->orderBy('sequence');
    }

    /** @return HasMany<SdStatus, $this> */
    public function statuses(): HasMany
    {
        return $this->hasMany(SdStatus::class, 'desk_id')->orderBy('sort_order');
    }

    /** @return HasMany<SdPriority, $this> */
    public function priorities(): HasMany
    {
        return $this->hasMany(SdPriority::class, 'desk_id')->orderBy('sort_order');
    }

    /** @return HasMany<SdSeverity, $this> */
    public function severities(): HasMany
    {
        return $this->hasMany(SdSeverity::class, 'desk_id')->orderBy('sort_order');
    }

    /** @return HasMany<SdCategory, $this> */
    public function categories(): HasMany
    {
        return $this->hasMany(SdCategory::class, 'desk_id')->orderBy('sort_order');
    }

    /** @return HasMany<SdTicket, $this> */
    public function tickets(): HasMany
    {
        return $this->hasMany(SdTicket::class, 'desk_id');
    }

    /** @return HasMany<SdProcedure, $this> */
    public function procedures(): HasMany
    {
        return $this->hasMany(SdProcedure::class, 'desk_id');
    }

    /** @return HasMany<SdSlaPolicy, $this> */
    public function slaPolicies(): HasMany
    {
        return $this->hasMany(SdSlaPolicy::class, 'desk_id');
    }
}
