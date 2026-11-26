<?php

namespace App\Domains\Assistant\Support;

use Illuminate\Support\Str;

/**
 * Bearer token that the Copilot Studio agent passes back to Laravel on tool calls.
 *
 * Format: "{conversation uuid}.{hmac}". The HMAC is keyed with APP_KEY, so a token cannot be forged
 * for another conversation. The conversation row (user, tenant, expiry) is still the source of truth.
 */
final class ConversationToken
{
    private const PURPOSE = 'assistant-conversation';

    public static function issue(string $conversationId): string
    {
        return $conversationId.'.'.self::signature($conversationId);
    }

    public static function conversationIdFrom(string $token): ?string
    {
        $separator = strrpos($token, '.');
        if ($separator === false) {
            return null;
        }

        $conversationId = substr($token, 0, $separator);
        $signature = substr($token, $separator + 1);

        if (! Str::isUuid($conversationId) || ! hash_equals(self::signature($conversationId), $signature)) {
            return null;
        }

        return $conversationId;
    }

    private static function signature(string $conversationId): string
    {
        return hash_hmac('sha256', self::PURPOSE.'|'.$conversationId, (string) config('app.key'));
    }
}
