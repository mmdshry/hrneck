<?php

namespace App\Domains\Assistant\Support;

use RuntimeException;

/**
 * The Copilot Studio service rejected or could not complete a Direct Line request.
 */
class AssistantUnavailableException extends RuntimeException {}
