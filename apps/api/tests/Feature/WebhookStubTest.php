<?php

use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

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
