<?php

namespace App\Domains\DemoRequests\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class TurnstileVerifier
{
    private const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    /**
     * Fails closed: a missing secret, an empty token, an unreachable Cloudflare, or a rejected token all return false.
     */
    public function verify(string $token, ?string $ipAddress): bool
    {
        $secret = (string) config('services.turnstile.secret_key');
        if ($secret === '' || $token === '') {
            return false;
        }

        try {
            $response = Http::asForm()
                ->timeout(5)
                ->post(self::SITEVERIFY_URL, array_filter([
                    'secret' => $secret,
                    'response' => $token,
                    'remoteip' => $ipAddress,
                ]));
        } catch (ConnectionException $exception) {
            report($exception);

            return false;
        }

        return $response->successful() && $response->json('success') === true;
    }
}
