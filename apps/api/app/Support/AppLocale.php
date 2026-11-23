<?php

namespace App\Support;

final class AppLocale
{
    public const DEFAULT = 'en';

    /** @var list<string> */
    public const ALLOWED = ['en', 'es', 'fr', 'pt', 'de', 'ru'];

    public static function normalize(?string $value): string
    {
        if (! is_string($value)) {
            return self::DEFAULT;
        }

        $locale = strtolower(trim($value));

        return in_array($locale, self::ALLOWED, true) ? $locale : self::DEFAULT;
    }
}
