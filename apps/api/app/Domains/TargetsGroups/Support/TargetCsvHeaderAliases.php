<?php

namespace App\Domains\TargetsGroups\Support;

final class TargetCsvHeaderAliases
{
    /**
     * Normalized alias => platform field.
     *
     * @var array<string, string>
     */
    private const ALIASES = [
        'email' => 'email',
        'e_mail' => 'email',
        'email_address' => 'email',
        'mail' => 'email',
        'work_email' => 'email',
        'user_email' => 'email',
        'first_name' => 'first_name',
        'firstname' => 'first_name',
        'given_name' => 'first_name',
        'first' => 'first_name',
        'last_name' => 'last_name',
        'lastname' => 'last_name',
        'surname' => 'last_name',
        'family_name' => 'last_name',
        'last' => 'last_name',
        'department' => 'department',
        'dept' => 'department',
        'department_name' => 'department',
        'team' => 'department',
        'job_title' => 'job_title',
        'title' => 'job_title',
        'position' => 'job_title',
        'role' => 'job_title',
        'job' => 'job_title',
        'employee_number' => 'employee_number',
        'employee_id' => 'employee_number',
        'employee_no' => 'employee_number',
        'emp_id' => 'employee_number',
        'emp_no' => 'employee_number',
        'staff_id' => 'employee_number',
        'personnel_number' => 'employee_number',
        'phone' => 'phone',
        'phone_number' => 'phone',
        'mobile' => 'phone',
        'mobile_phone' => 'phone',
        'cell' => 'phone',
        'telephone' => 'phone',
        'location' => 'location',
        'office' => 'location',
        'office_location' => 'location',
        'city' => 'location',
        'site' => 'location',
        'employment_type' => 'employment_type',
        'employee_type' => 'employment_type',
        'work_type' => 'employment_type',
        'contract_type' => 'employment_type',
        'hire_date' => 'hire_date',
        'start_date' => 'hire_date',
        'joining_date' => 'hire_date',
        'date_of_hire' => 'hire_date',
        'hired_on' => 'hire_date',
        'manager_email' => 'manager_email',
        'manager' => 'manager_email',
        'manager_mail' => 'manager_email',
        'reports_to' => 'manager_email',
        'reports_to_email' => 'manager_email',
        'preferred_language' => 'preferred_language',
        'language' => 'preferred_language',
        'locale' => 'preferred_language',
        'lang' => 'preferred_language',
        'timezone' => 'timezone',
        'time_zone' => 'timezone',
        'tz' => 'timezone',
        'external_id' => 'external_id',
        'ext_id' => 'external_id',
        'externalid' => 'external_id',
        'source_id' => 'external_id',
    ];

    public static function normalize(string $header): string
    {
        $trimmed = trim($header);
        $trimmed = preg_replace('/^\xEF\xBB\xBF/', '', $trimmed) ?? $trimmed;
        $lower = mb_strtolower($trimmed);
        $normalized = preg_replace('/[^a-z0-9]+/u', '_', $lower) ?? $lower;

        return trim($normalized, '_');
    }

    public static function suggestField(string $header): ?string
    {
        $normalized = self::normalize($header);

        return self::ALIASES[$normalized] ?? null;
    }

    /**
     * @param  list<string>  $headers
     * @return array<string, string|null>
     */
    public static function suggestMap(array $headers): array
    {
        $map = [];
        foreach (TargetProfileFields::CSV_HEADERS as $field) {
            $map[$field] = null;
        }

        $usedHeaders = [];
        foreach ($headers as $header) {
            $field = self::suggestField($header);
            if ($field === null) {
                continue;
            }
            if (($map[$field] ?? null) !== null) {
                continue;
            }
            if (isset($usedHeaders[$header])) {
                continue;
            }
            $map[$field] = $header;
            $usedHeaders[$header] = true;
        }

        return $map;
    }
}
