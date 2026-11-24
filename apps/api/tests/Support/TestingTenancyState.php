<?php

namespace Tests\Support;

/**
 * Process-wide state for {@see RefreshTestingTenancy}.
 *
 * Pest creates a distinct test class per file; trait statics are therefore
 * not shared across Feature files.
 */
final class TestingTenancyState
{
    public static bool $seeded = false;
}
