<?php

use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('integrations endpoint reports smtp status without secrets', function () {
    config([
        'mail.mailers.smtp.host' => 'mail.hrneck.com',
        'mail.mailers.smtp.port' => 465,
        'mail.mailers.smtp.username' => 'noreply@hrneck.com',
        'mail.from.address' => 'noreply@hrneck.com',
        'brand.support_address' => 'support@hrneck.com',
    ]);

    $user = orgAdmin();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/integrations')
        ->assertOk()
        ->assertJsonPath('data.0.id', 'smtp')
        ->assertJsonPath('data.0.status', 'connected')
        ->assertJsonPath('data.0.details.host', 'mail.hrneck.com')
        ->assertJsonMissingPath('data.0.details.password');
});
