<?php

namespace App\Domains\IdentityAccess\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Short-lived, single-use records for an SSO sign-in.
 *
 * The OAuth state lives in the cache rather than the session: the callback arrives on the fixed API host, while the
 * session cookie belongs to the tenant host that started the flow. The handoff token carries the signed-in user from
 * the callback to the tenant host, where the session cookie is created.
 *
 * @phpstan-type SsoFlow array{provider: string, nonce: string, origin: string, next: ?string, remember: bool}
 * @phpstan-type SsoHandoff array{user_id: int, next: ?string, remember: bool, tenant: ?string}
 */
class SsoFlowStore
{
    private const STATE_TTL_SECONDS = 600;

    private const HANDOFF_TTL_SECONDS = 60;

    /**
     * @param  SsoFlow  $flow
     */
    public function putState(string $state, array $flow): void
    {
        Cache::put($this->stateKey($state), $flow, self::STATE_TTL_SECONDS);
    }

    /**
     * Consumes the state. A state can be used once; unknown or expired states return null.
     *
     * @return SsoFlow|null
     */
    public function pullState(string $state): ?array
    {
        if ($state === '') {
            return null;
        }

        /** @var SsoFlow|null $flow */
        $flow = Cache::pull($this->stateKey($state));

        return $flow;
    }

    /**
     * @param  SsoHandoff  $handoff
     * @return string The one-time token to exchange on the tenant host.
     */
    public function putHandoff(array $handoff): string
    {
        $token = bin2hex(random_bytes(32));
        Cache::put($this->handoffKey($token), $handoff, self::HANDOFF_TTL_SECONDS);

        return $token;
    }

    /**
     * Consumes the handoff token. A token can be exchanged once.
     *
     * @return SsoHandoff|null
     */
    public function pullHandoff(string $token): ?array
    {
        if ($token === '') {
            return null;
        }

        /** @var SsoHandoff|null $handoff */
        $handoff = Cache::pull($this->handoffKey($token));

        return $handoff;
    }

    private function stateKey(string $state): string
    {
        return 'sso:state:'.hash('sha256', $state);
    }

    private function handoffKey(string $token): string
    {
        return 'sso:handoff:'.hash('sha256', $token);
    }
}
