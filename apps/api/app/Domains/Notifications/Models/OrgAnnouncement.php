<?php

namespace App\Domains\Notifications\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $title
 * @property string $body
 * @property int|null $published_by
 * @property \Illuminate\Support\Carbon|null $published_at
 */
class OrgAnnouncement extends Model
{
    protected $table = 'org_announcements';

    protected $fillable = [
        'title',
        'body',
        'published_by',
        'published_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'published_by' => 'integer',
            'published_at' => 'datetime',
        ];
    }
}
