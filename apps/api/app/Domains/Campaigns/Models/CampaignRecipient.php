<?php

namespace App\Domains\Campaigns\Models;

use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $tracking_token
 * @property-read Campaign|null $campaign
 * @property-read Target|null $target
 */
class CampaignRecipient extends Model
{
    protected $fillable = [
        'campaign_id', 'target_id', 'tracking_token', 'status',
        'sent_at', 'opened_at', 'clicked_at', 'submitted_at', 'reported_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'opened_at' => 'datetime',
            'clicked_at' => 'datetime',
            'submitted_at' => 'datetime',
            'reported_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Campaign, $this> */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /** @return BelongsTo<Target, $this> */
    public function target(): BelongsTo
    {
        return $this->belongsTo(Target::class);
    }
}
