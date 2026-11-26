<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // SSO sign-in (Google + Microsoft Entra / personal accounts). Credentials are global to the platform.
    // The redirect URI must be registered exactly in each provider console; it always points at the API host.
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', rtrim((string) env('APP_URL', 'http://localhost'), '/').'/api/v1/auth/oauth/google/callback'),
    ],

    // Microsoft is served by socialiteproviders/microsoft-azure, registered under the "azure" driver name.
    // "common" accepts work/school accounts from any directory and personal Microsoft accounts.
    'azure' => [
        'client_id' => env('AZURE_CLIENT_ID'),
        'client_secret' => env('AZURE_CLIENT_SECRET'),
        'redirect' => env('AZURE_REDIRECT_URI', rtrim((string) env('APP_URL', 'http://localhost'), '/').'/api/v1/auth/oauth/microsoft/callback'),
        'tenant' => env('AZURE_TENANT_ID', 'common'),
    ],

    // Microsoft Copilot Studio agent used by the in-app assistant. Secrets live only in .env.
    // environment_id, schema_name and tenant_id identify the agent in Power Platform (reference values for setup).
    // Conversations use the Direct Line REST API, authenticated with the agent's Web channel secret.
    'copilot_studio' => [
        'environment_id' => env('COPILOT_STUDIO_ENVIRONMENT_ID'),
        'schema_name' => env('COPILOT_STUDIO_SCHEMA_NAME'),
        'tenant_id' => env('COPILOT_STUDIO_TENANT_ID'),
        'direct_line_base_url' => env('COPILOT_STUDIO_DIRECT_LINE_BASE_URL', 'https://directline.botframework.com'),
        'direct_line_secret' => env('COPILOT_STUDIO_DIRECT_LINE_SECRET'),
        // Sent by the Copilot Studio custom connector in the X-Assistant-Api-Key header on tool calls.
        'connector_api_key' => env('COPILOT_STUDIO_CONNECTOR_API_KEY'),
        // Tenant ids allowed to use the assistant during the pilot (comma-separated).
        'pilot_tenant_ids' => array_values(array_filter(array_map(
            static fn (string $id): string => trim($id),
            explode(',', (string) env('COPILOT_STUDIO_PILOT_TENANT_IDS', '')),
        ))),
        'conversation_ttl_minutes' => (int) env('COPILOT_STUDIO_CONVERSATION_TTL_MINUTES', 30),
        'pending_action_ttl_minutes' => (int) env('COPILOT_STUDIO_PENDING_ACTION_TTL_MINUTES', 15),
        'reply_timeout_seconds' => (int) env('COPILOT_STUDIO_REPLY_TIMEOUT_SECONDS', 20),
        'poll_interval_ms' => (int) env('COPILOT_STUDIO_POLL_INTERVAL_MS', 1000),
    ],

];
