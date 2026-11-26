<?php

namespace App\Domains\Assistant\Actions;

use App\Domains\Assistant\Models\AssistantConversation;
use App\Domains\Assistant\Support\AssistantUnavailableException;
use App\Domains\Assistant\Support\CopilotStudioSettings;
use App\Domains\Assistant\Support\DirectLineClient;
use App\Models\User;
use App\Support\StaffTenant;

class StartConversation
{
    public function __construct(
        private readonly CopilotStudioSettings $settings,
        private readonly DirectLineClient $directLine,
    ) {}

    /**
     * @throws AssistantUnavailableException
     */
    public function handle(User $user, string $tenantId): AssistantConversation
    {
        if (! $this->settings->isEnabledForTenant($tenantId)) {
            abort(403, 'The assistant is not enabled for this organization.');
        }

        // Members chat as themselves. Platform staff may chat only while acting in this tenant, and then
        // the tools run with the staff permissions for the tenant (see OrgPermissionCatalog).
        $isMember = $user->belongsToTenant($tenantId);
        $isActingStaff = $user->isPlatformStaff() && StaffTenant::matches($tenantId);
        if (! $isMember && ! $isActingStaff) {
            abort(403, 'You do not belong to this organization.');
        }

        $started = $this->directLine->startConversation();

        return AssistantConversation::query()->create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'copilot_conversation_id' => $started['conversation_id'],
            'direct_line_token' => $started['token'],
            'expires_at' => now()->addMinutes($this->settings->conversationTtlMinutes()),
        ]);
    }
}
