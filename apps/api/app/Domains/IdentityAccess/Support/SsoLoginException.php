<?php

namespace App\Domains\IdentityAccess\Support;

use RuntimeException;

/**
 * Raised when an SSO sign-in cannot complete. The message is for logs only; the browser only receives $error.
 */
class SsoLoginException extends RuntimeException
{
    public function __construct(public readonly SsoError $error, string $message)
    {
        parent::__construct($message);
    }
}
