<?php

namespace App\Support;

use DateTime;
use DateTimeZone;
use Throwable;

final class TimezoneOptions
{
    /**
     * @return array<string, string>
     */
    public static function all(): array
    {
        $ids = DateTimeZone::listIdentifiers();
        sort($ids, SORT_STRING);

        $options = [];
        $now = new DateTime('now');

        foreach ($ids as $id) {
            $options[$id] = self::labelFor($id, $now);
        }

        return $options;
    }

    private static function labelFor(string $id, DateTime $now): string
    {
        try {
            $tz = new DateTimeZone($id);
            $local = (clone $now)->setTimezone($tz);
            $offset = $local->format('P');
            if ($offset === 'Z') {
                $offset = '+00:00';
            }

            return $id.' (UTC'.$offset.')';
        } catch (Throwable) {
            return $id;
        }
    }
}
