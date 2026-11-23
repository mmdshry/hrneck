<?php

namespace App\Domains\TargetsGroups\Actions;

use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\TargetProfileFields;
use App\Domains\TrainingLms\Models\Enrollment;
use Carbon\CarbonInterface;

class RecalculateTargetRisk
{
    public const WINDOW_DAYS = 90;

    /**
     * @param  bool  $force  Kept for call-site compatibility; risk is always recomputed.
     */
    public function handle(Target $target, bool $force = false): Target
    {
        unset($force);

        $since = now()->subDays(self::WINDOW_DAYS);

        $score = 5;

        $recipients = CampaignRecipient::query()
            ->where('target_id', $target->id)
            ->where(function ($query) use ($since): void {
                $query->where('clicked_at', '>=', $since)
                    ->orWhere('submitted_at', '>=', $since)
                    ->orWhere('reported_at', '>=', $since);
            })
            ->get(['clicked_at', 'submitted_at', 'reported_at']);

        $submitBonus = 0;
        $clickBonus = 0;
        $reportCredit = 0;

        foreach ($recipients as $recipient) {
            if ($recipient->submitted_at !== null && $recipient->submitted_at >= $since) {
                $submitBonus += 40;
            }
            if ($recipient->clicked_at !== null && $recipient->clicked_at >= $since) {
                $reported = $recipient->reported_at !== null && $recipient->reported_at >= $since;
                if (! $reported) {
                    $clickBonus += 20;
                }
            }
            if ($recipient->reported_at !== null && $recipient->reported_at >= $since) {
                $reportCredit += 15;
            }
        }

        $score += min(80, $submitBonus);
        $score += min(60, $clickBonus);
        $score -= min(45, $reportCredit);

        $hasOverdueTraining = Enrollment::query()
            ->where('target_id', $target->id)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->where(function ($query) use ($since): void {
                $query->whereNull('completed_at')
                    ->where(function ($inner) use ($since): void {
                        $inner->where('created_at', '<=', $since)
                            ->orWhereNotNull('opened_at');
                    });
            })
            ->exists();

        if ($hasOverdueTraining) {
            $score += 10;
        }

        if ($target->last_training_completed_at instanceof CarbonInterface
            && $target->last_training_completed_at >= $since) {
            $score -= 5;
        }

        $score = max(0, min(100, $score));
        $tier = TargetProfileFields::tierFromScore($score);

        $target->forceFill([
            'risk_score' => $score,
            'risk_tier' => $tier,
            'risk_updated_at' => now(),
            'risk_source' => TargetProfileFields::RISK_SOURCE_COMPUTED,
        ])->save();

        return $target->fresh() ?? $target;
    }
}
