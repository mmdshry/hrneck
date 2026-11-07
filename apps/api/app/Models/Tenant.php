<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Domain;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

/**
 * @property string $id
 * @property string|null $name
 * @property string|null $industry
 * @property string|null $employee_band
 * @property string $status
 * @property bool $training_enabled
 * @property array<string, mixed>|null $data
 */
class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase;
    use HasDomains;

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return [
            'training_enabled' => 'boolean',
        ];
    }

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'name',
            'industry',
            'employee_band',
            'status',
            'training_enabled',
        ];
    }

    /** @return HasMany<Domain, $this> */
    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class);
    }
}
