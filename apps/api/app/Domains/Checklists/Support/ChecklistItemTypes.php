<?php

namespace App\Domains\Checklists\Support;

final class ChecklistItemTypes
{
    public const SECTION = 'section';

    public const CHECKBOX = 'checkbox';

    public const SHORT_TEXT = 'short_text';

    public const LONG_TEXT = 'long_text';

    public const SINGLE_SELECT = 'single_select';

    public const MULTI_SELECT = 'multi_select';

    public const DATE = 'date';

    public const NUMBER = 'number';

    public const FILE = 'file';

    public const LINK = 'link';

    public const RICH_NOTE = 'rich_note';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::SECTION,
            self::CHECKBOX,
            self::SHORT_TEXT,
            self::LONG_TEXT,
            self::SINGLE_SELECT,
            self::MULTI_SELECT,
            self::DATE,
            self::NUMBER,
            self::FILE,
            self::LINK,
            self::RICH_NOTE,
        ];
    }

    /**
     * Types that collect answers / count toward progress.
     *
     * @return list<string>
     */
    public static function answerable(): array
    {
        return [
            self::CHECKBOX,
            self::SHORT_TEXT,
            self::LONG_TEXT,
            self::SINGLE_SELECT,
            self::MULTI_SELECT,
            self::DATE,
            self::NUMBER,
            self::FILE,
        ];
    }
}
