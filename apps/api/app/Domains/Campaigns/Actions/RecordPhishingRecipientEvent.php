<?php

namespace App\Domains\Campaigns\Actions;

use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TargetsGroups\Actions\RecalculateTargetRisk;
use App\Domains\TargetsGroups\Models\Target;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RecordPhishingRecipientEvent
{
    public function __construct(private readonly RecalculateTargetRisk $recalculate) {}

    /**
     * @param  string  $event  One of clicked, submitted, reported. Other values are rejected.
     */
    public function handle(CampaignRecipient $recipient, string $event, bool $recalculateRisk = true): CampaignRecipient
    {
        $allowed = ['clicked', 'submitted', 'reported'];
        if (! in_array($event, $allowed, true)) {
            throw ValidationException::withMessages([
                'event' => ['Event must be clicked, submitted, or reported.'],
            ]);
        }

        $updates = [];
        $now = now();

        if ($recipient->tracking_token === null || $recipient->tracking_token === '') {
            $updates['tracking_token'] = Str::random(40);
        }

        if ($event === 'clicked' && $recipient->clicked_at === null) {
            $updates['clicked_at'] = $now;
            if (in_array($recipient->status, ['pending', 'sent'], true)) {
                $updates['status'] = 'clicked';
            }
        }

        if ($event === 'submitted') {
            if ($recipient->clicked_at === null) {
                $updates['clicked_at'] = $now;
            }
            if ($recipient->submitted_at === null) {
                $updates['submitted_at'] = $now;
            }
            $updates['status'] = 'submitted';
        }

        if ($event === 'reported') {
            if ($recipient->reported_at === null) {
                $updates['reported_at'] = $now;
            }
            if (! in_array($recipient->status, ['submitted'], true)) {
                $updates['status'] = 'reported';
            }
        }

        if ($updates !== []) {
            $recipient->forceFill($updates)->save();
        }

        if ($recalculateRisk) {
            $target = Target::query()->find($recipient->target_id);
            if ($target !== null) {
                $this->recalculate->handle($target);
            }
        }

        return $recipient->fresh() ?? $recipient;
    }
}
