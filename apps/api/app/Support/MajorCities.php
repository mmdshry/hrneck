<?php

namespace App\Support;

final class MajorCities
{
    /** @var list<string>|null */
    private static ?array $all = null;

    /** @var array<string, true>|null */
    private static ?array $set = null;

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        if (self::$all !== null) {
            return self::$all;
        }

        $path = resource_path('data/major-cities.json');
        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded)) {
            self::$all = [];

            return self::$all;
        }

        /** @var list<string> $cities */
        $cities = array_values(array_filter($decoded, fn ($value): bool => is_string($value) && $value !== ''));
        self::$all = $cities;

        return self::$all;
    }

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        $options = [];
        foreach (self::all() as $city) {
            $options[$city] = $city;
        }

        return $options;
    }

    public static function isValid(?string $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }

        if (self::$set === null) {
            self::$set = array_fill_keys(self::all(), true);
        }

        return isset(self::$set[$value]);
    }

    public static function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        return self::isValid($trimmed) ? $trimmed : null;
    }
}
