<?php

namespace App\Domains\CustomDomains\Actions;

class BuildDnsGuidance
{
    /**
     * @return array{domain: string, records: list<array{type: string, host: string, value: string, purpose: string}>}
     */
    public function handle(string $sendingDomain): array
    {
        $domain = strtolower(trim($sendingDomain));
        $base = (string) config('brand.domain', 'hrneck.test');
        $short = strtolower((string) config('brand.short', 'HRNECK'));

        return [
            'domain' => $domain,
            'records' => [
                [
                    'type' => 'TXT',
                    'host' => '@',
                    'value' => 'v=spf1 include:_spf.'.$base.' ~all',
                    'purpose' => 'SPF — authorize '.config('brand.short').' mail servers',
                ],
                [
                    'type' => 'CNAME',
                    'host' => $short.'._domainkey',
                    'value' => $short.'._domainkey.'.$base,
                    'purpose' => 'DKIM — signing key',
                ],
                [
                    'type' => 'TXT',
                    'host' => '_dmarc',
                    'value' => 'v=DMARC1; p=none; rua=mailto:dmarc@'.$domain,
                    'purpose' => 'DMARC — reporting policy',
                ],
                [
                    'type' => 'CNAME',
                    'host' => 'track',
                    'value' => 'track.'.$base,
                    'purpose' => 'Tracking / landing host',
                ],
            ],
        ];
    }
}
