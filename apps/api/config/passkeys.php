<?php

return [

    /*
    |--------------------------------------------------------------------------
    | WebAuthn Relying Party
    |--------------------------------------------------------------------------
    |
    | The RP ID is the registrable base domain (e.g. "hrneck.test"), so one
    | passkey works on every tenant subdomain ("{slug}.hrneck.test").
    | Passkeys require a secure context: HTTPS, or "localhost" during development.
    |
    */

    'rp_name' => env('PASSKEY_RP_NAME', env('BRAND_SHORT', 'HRneck')),

    'rp_id' => env('PASSKEY_RP_ID', env('BRAND_DOMAIN', 'hrneck.test')),

    /*
    |--------------------------------------------------------------------------
    | Allowed origins
    |--------------------------------------------------------------------------
    |
    | Comma-separated list of full origins (scheme://host[:port]). Subdomains of
    | each entry are accepted, so "https://hrneck.test" also allows
    | "https://acme.hrneck.test".
    |
    */

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('PASSKEY_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://hrneck.test')))
    ))),

    /*
    |--------------------------------------------------------------------------
    | Ceremony timeouts
    |--------------------------------------------------------------------------
    */

    'ceremony_timeout_ms' => 60000,

    'challenge_ttl_seconds' => 300,

];
