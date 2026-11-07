<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SdEmailReader extends Model
{
    protected $table = 'sd_email_readers';

    protected $fillable = [
        'name',
        'desk_id',
        'host',
        'port',
        'encryption',
        'username',
        'password',
        'mailbox',
        'is_active',
        'defaults',
        'blacklist',
        'last_polled_at',
        'fail_count',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'port' => 'integer',
            'password' => 'encrypted',
            'is_active' => 'boolean',
            'defaults' => 'array',
            'blacklist' => 'array',
            'last_polled_at' => 'datetime',
            'fail_count' => 'integer',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }

    /** @return HasMany<SdEmailInboundLog, $this> */
    public function logs(): HasMany
    {
        return $this->hasMany(SdEmailInboundLog::class, 'email_reader_id');
    }
}
