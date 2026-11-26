<?php

namespace App\Domains\TargetsGroups\Support;

final class TargetProfileFields
{
    public const EMPLOYMENT_TYPES = [
        'full_time',
        'part_time',
        'contractor',
        'intern',
    ];

    public const RISK_TIERS = [
        'unknown',
        'low',
        'medium',
        'high',
    ];

    public const RISK_SOURCE_MANUAL = 'manual';

    public const RISK_SOURCE_COMPUTED = 'computed';

    /** Employee created automatically for an organization account (every account is an employee). */
    public const JOINED_VIA_ACCOUNT = 'account';

    /** Legacy value for employees created when a learner role was granted. */
    public const JOINED_VIA_LEARNER_ROLE = 'learner_role';

    public const JOINED_VIA = [
        'manual',
        'csv',
        'directory',
        self::JOINED_VIA_LEARNER_ROLE,
        self::JOINED_VIA_ACCOUNT,
    ];

    /** Employees that exist only because their login exists, so deleting the login removes them. */
    public const AUTO_CREATED_JOINED_VIA = [
        self::JOINED_VIA_LEARNER_ROLE,
        self::JOINED_VIA_ACCOUNT,
    ];

    public const CSV_HEADERS = [
        'email',
        'first_name',
        'last_name',
        'department',
        'job_title',
        'employee_number',
        'phone',
        'location',
        'employment_type',
        'hire_date',
        'manager_email',
        'preferred_language',
        'external_id',
    ];

    public static function tierFromScore(int $score): string
    {
        $clamped = max(0, min(100, $score));
        if ($clamped <= 33) {
            return 'low';
        }
        if ($clamped <= 66) {
            return 'medium';
        }

        return 'high';
    }

    /**
     * @return list<string>
     */
    public static function profileAttributeKeys(): array
    {
        return [
            'job_title',
            'manager_target_id',
            'hire_date',
            'employee_number',
            'phone',
            'location',
            'employment_type',
            'preferred_language',
            'external_id',
            'notification_opt_out',
        ];
    }
}
