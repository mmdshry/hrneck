<?php

namespace App\Domains\Integrations\Actions;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class DispatchWebhookStub
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{delivered: bool, status: int|null}
     */
    public function handle(?string $url, string $event, array $payload): array
    {
        if ($url === null || $url === '') {
            Log::info('webhook.stub.skipped', ['event' => $event]);

            return ['delivered' => false, 'status' => null];
        }

        $this->assertSafeWebhookUrl($url);

        $response = Http::timeout(5)->acceptJson()->asJson()->post($url, [
            'event' => $event,
            'brand' => config('brand.short'),
            'payload' => $payload,
        ]);

        return [
            'delivered' => $response->successful(),
            'status' => $response->status(),
        ];
    }

    private function assertSafeWebhookUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new InvalidArgumentException('Webhook URL must be a valid http(s) URL.');
        }

        if (in_array($host, ['localhost', 'metadata.google.internal'], true) || str_ends_with($host, '.local')) {
            throw new InvalidArgumentException('Webhook URL host is not allowed.');
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP)
            ? [$host]
            : (gethostbynamel($host) ?: []);

        foreach ($ips as $ip) {
            if ($this->isPrivateOrReservedIp($ip)) {
                throw new InvalidArgumentException('Webhook URL resolves to a private or reserved address.');
            }
        }
    }

    private function isPrivateOrReservedIp(string $ip): bool
    {
        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) === false;
    }
}
