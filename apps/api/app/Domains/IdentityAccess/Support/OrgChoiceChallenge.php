<?php

namespace App\Domains\IdentityAccess\Support;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Short-lived token issued after one password matched several organization logins. It keeps only the
 * matching login ids (never the password), so the user can pick an organization without typing it again.
 */
class OrgChoiceChallenge
{
    private const TTL_MINUTES = 10;

    /**
     * @param  Collection<int, User>  $logins
     */
    public function issue(Collection $logins, bool $remember): string
    {
        $token = Str::random(64);

        cache()->put(
            $this->cacheKey($token),
            [
                'user_ids' => $logins->map(fn (User $login): mixed => $login->getKey())->values()->all(),
                'remember' => $remember,
            ],
            now()->addMinutes(self::TTL_MINUTES),
        );

        return $token;
    }

    /**
     * @return array{logins: Collection<int, User>, remember: bool}|null
     */
    public function fromToken(string $token): ?array
    {
        $payload = cache()->get($this->cacheKey($token));
        if (! is_array($payload) || ! is_array($payload['user_ids'] ?? null)) {
            return null;
        }

        $logins = User::query()->with('tenant')->whereIn('id', $payload['user_ids'])->get();
        if ($logins->isEmpty()) {
            return null;
        }

        return [
            'logins' => $logins,
            'remember' => (bool) ($payload['remember'] ?? false),
        ];
    }

    public function consume(string $token): void
    {
        cache()->forget($this->cacheKey($token));
    }

    private function cacheKey(string $token): string
    {
        return 'org_choice_challenge:'.$token;
    }
}
