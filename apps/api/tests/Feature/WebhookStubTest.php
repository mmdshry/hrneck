<?php

use Illuminate\Support\Facades\Http;

test('webhook stub skips empty urls and posts when a public url is provided', function () {
    Http::fake([
        'https://example.com/*' => Http::response(['ok' => true], 200),
    ]);

    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/webhooks/test', [
            'event' => 'campaign.launched',
            'payload' => ['id' => 1],
        ])
        ->assertOk()
        ->assertJsonPath('data.delivered', false)
        ->assertJsonPath('data.status', null);

    Http::assertNothingSent();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/webhooks/test', [
            'url' => 'https://example.com/hooks/hrneck',
            'event' => 'campaign.launched',
            'payload' => ['id' => 1],
        ])
        ->assertOk()
        ->assertJsonPath('data.delivered', true)
        ->assertJsonPath('data.status', 200);

    Http::assertSent(function ($request) {
        return $request->url() === 'https://example.com/hooks/hrneck'
            && $request['event'] === 'campaign.launched';
    });
});

test('webhook stub rejects private hosts', function () {
    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/webhooks/test', [
            'url' => 'http://127.0.0.1/hook',
            'event' => 'campaign.launched',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['url']);
});

test('webhook stub does not follow redirects', function () {
    Http::fake([
        'https://example.com/hooks/redirect' => Http::response(null, 302, [
            'Location' => 'http://127.0.0.1/secret',
        ]),
        'http://127.0.0.1/*' => Http::response(['pwned' => true], 200),
    ]);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/webhooks/test', [
            'url' => 'https://example.com/hooks/redirect',
            'event' => 'campaign.launched',
            'payload' => ['id' => 1],
        ])
        ->assertOk()
        ->assertJsonPath('data.delivered', false)
        ->assertJsonPath('data.status', 302);

    Http::assertSentCount(1);
    Http::assertNotSent(fn ($request) => str_contains($request->url(), '127.0.0.1'));
});
