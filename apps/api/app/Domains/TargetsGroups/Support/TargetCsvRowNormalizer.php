<?php

namespace App\Domains\TargetsGroups\Support;

use App\Support\AppLocale;
use App\Support\MajorCities;
use Carbon\Carbon;

final class TargetCsvRowNormalizer
{
    /**
     * @param  array<string, string>  $item
     * @return array{
     *   values: array<string, mixed>,
     *   warnings: list<string>
     * }
     */
    public function normalize(array $item): array
    {
        $warnings = [];
        $values = [
            'first_name' => $this->nullableString($item['first_name'] ?? null),
            'last_name' => $this->nullableString($item['last_name'] ?? null),
            'department' => $this->nullableString($item['department'] ?? null),
            'job_title' => $this->nullableString($item['job_title'] ?? null),
            'employee_number' => $this->nullableString($item['employee_number'] ?? null),
            'phone' => $this->nullableString($item['phone'] ?? null, 40),
            'external_id' => $this->nullableString($item['external_id'] ?? null),
            'manager_email' => $this->nullableString($item['manager_email'] ?? null),
        ];

        $locationRaw = $this->nullableString($item['location'] ?? null);
        if ($locationRaw === null) {
            $values['location'] = null;
        } elseif (MajorCities::isValid($locationRaw)) {
            $values['location'] = $locationRaw;
        } else {
            $values['location'] = null;
            $warnings[] = 'Invalid location; value ignored. Use Country/City (e.g. Iran/Tehran).';
        }

        $languageRaw = $this->nullableString($item['preferred_language'] ?? null, 16);
        if ($languageRaw === null) {
            $values['preferred_language'] = null;
        } else {
            $normalized = strtolower($languageRaw);
            if (in_array($normalized, AppLocale::ALLOWED, true)) {
                $values['preferred_language'] = $normalized;
            } else {
                $values['preferred_language'] = AppLocale::DEFAULT;
                $warnings[] = 'Invalid preferred_language; defaulted to '.AppLocale::DEFAULT.'.';
            }
        }

        $employment = $this->nullableString($item['employment_type'] ?? null);
        if ($employment !== null) {
            $employment = strtolower($employment);
            if (in_array($employment, TargetProfileFields::EMPLOYMENT_TYPES, true)) {
                $values['employment_type'] = $employment;
            } else {
                $values['employment_type'] = null;
                $warnings[] = 'Invalid employment_type; value ignored.';
            }
        } else {
            $values['employment_type'] = null;
        }

        $hireRaw = $this->nullableString($item['hire_date'] ?? null, 32);
        if ($hireRaw !== null) {
            try {
                $values['hire_date'] = Carbon::parse($hireRaw)->toDateString();
            } catch (\Throwable) {
                $values['hire_date'] = null;
                $warnings[] = 'Invalid hire_date; value ignored.';
            }
        } else {
            $values['hire_date'] = null;
        }

        if ($this->nullableString($item['risk_score'] ?? null, 16) !== null
            || $this->nullableString($item['risk_tier'] ?? null, 32) !== null) {
            $warnings[] = 'risk_score and risk_tier are computed automatically; CSV values ignored.';
        }

        return [
            'values' => $values,
            'warnings' => $warnings,
        ];
    }

    private function nullableString(mixed $value, int $max = 120): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return null;
        }

        return mb_substr($trimmed, 0, $max);
    }
}
