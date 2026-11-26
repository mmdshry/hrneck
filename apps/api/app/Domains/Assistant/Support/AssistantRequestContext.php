<?php

namespace App\Domains\Assistant\Support;

use App\Domains\Assistant\Models\AssistantConversation;
use App\Models\User;

/**
 * Identity resolved from a conversation token. Tool handlers act only as this user, in this tenant.
 */
final readonly class AssistantRequestContext
{
    public function __construct(
        public AssistantConversation $conversation,
        public User $user,
        public string $tenantId,
    ) {}
}
