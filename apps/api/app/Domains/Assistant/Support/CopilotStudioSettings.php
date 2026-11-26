<?php

namespace App\Domains\Assistant\Support;

/**
 * Typed access to the services.copilot_studio config block.
 */
final class CopilotStudioSettings
{
    public function directLineBaseUrl(): string
    {
        return rtrim((string) config('services.copilot_studio.direct_line_base_url'), '/');
    }

    public function directLineSecret(): string
    {
        return (string) config('services.copilot_studio.direct_line_secret', '');
    }

    public function connectorApiKey(): string
    {
        return (string) config('services.copilot_studio.connector_api_key', '');
    }

    public function isConfigured(): bool
    {
        return $this->directLineSecret() !== '' && $this->connectorApiKey() !== '';
    }

    /**
     * Pilot gate: the tenant must be listed and the agent must be fully configured.
     */
    public function isEnabledForTenant(string $tenantId): bool
    {
        /** @var list<string> $pilotTenants */
        $pilotTenants = config('services.copilot_studio.pilot_tenant_ids', []);

        return $this->isConfigured() && in_array($tenantId, $pilotTenants, true);
    }

    public function conversationTtlMinutes(): int
    {
        return max(1, (int) config('services.copilot_studio.conversation_ttl_minutes', 30));
    }

    public function pendingActionTtlMinutes(): int
    {
        return max(1, (int) config('services.copilot_studio.pending_action_ttl_minutes', 15));
    }

    public function replyTimeoutSeconds(): int
    {
        return max(1, (int) config('services.copilot_studio.reply_timeout_seconds', 20));
    }

    public function pollIntervalMs(): int
    {
        return max(0, (int) config('services.copilot_studio.poll_interval_ms', 1000));
    }
}
