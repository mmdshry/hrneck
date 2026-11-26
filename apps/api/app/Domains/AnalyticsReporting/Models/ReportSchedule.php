<?php

namespace App\Domains\AnalyticsReporting\Models;

use App\Domains\AnalyticsReporting\Actions\BuildOrgDetailedReport;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $name
 * @property string $cadence
 * @property string $format
 * @property string $section
 */
class ReportSchedule extends Model
{
    /** The eight-line metric summary; the original scheduled CSV content. */
    public const SUMMARY_SECTION = 'summary';

    /** Cadence used for one-off sends; no period is applied, so the CSV covers all data. */
    public const ON_DEMAND_CADENCE = 'on_demand';

    public const CADENCES = ['monthly', 'weekly', 'quarterly'];

    public const FORMATS = ['csv', 'pdf'];

    /** Sections a schedule (or one-off email) can carry; PDF schedules always use the business PDF. */
    public const SECTIONS = [self::SUMMARY_SECTION, ...BuildOrgDetailedReport::SECTIONS];

    protected $fillable = [
        'name', 'cadence', 'format', 'section', 'next_run_at', 'last_run_at',
    ];

    protected function casts(): array
    {
        return [
            'next_run_at' => 'datetime',
            'last_run_at' => 'datetime',
        ];
    }

    /** @return HasMany<ReportScheduleRecipient, $this> */
    public function recipients(): HasMany
    {
        return $this->hasMany(ReportScheduleRecipient::class, 'report_schedule_id');
    }

    /**
     * Users live on the central connection, so recipients are read as ids rather than joined.
     *
     * @return list<int>
     */
    public function recipientUserIds(): array
    {
        return $this->recipients()
            ->orderBy('id')
            ->pluck('user_id')
            ->map(fn ($userId): int => (int) $userId)
            ->values()
            ->all();
    }

    /**
     * Replaces the recipients with the given users. Callers check eligibility first.
     *
     * @param  list<int|string>  $userIds
     */
    public function syncRecipientUserIds(array $userIds): void
    {
        $userIds = array_values(array_unique(array_map(intval(...), $userIds)));

        $this->recipients()->whereNotIn('user_id', $userIds)->delete();

        $missing = array_values(array_diff($userIds, $this->recipientUserIds()));
        $this->recipients()->createMany(array_map(
            static fn (int $userId): array => ['user_id' => $userId],
            $missing,
        ));
    }
}
