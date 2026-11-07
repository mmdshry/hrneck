<?php

use App\Domains\CustomDomains\Actions\BuildDnsGuidance;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\DemoSeeder::class);
});

test('dns guidance includes spf dkim and dmarc stubs', function () {
    $guidance = app(BuildDnsGuidance::class)->handle('mail.example.test');

    expect($guidance['domain'])->toBe('mail.example.test')
        ->and(collect($guidance['records'])->pluck('type')->all())
        ->toContain('TXT', 'CNAME');
});

test('white-label settings and custom domain can be updated', function () {
    $user = orgAdmin();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->putJson('/api/v1/org/settings', [
            'display_name' => 'ITneck Demo',
            'primary_color' => '#115e59',
            'sending_domain' => 'mail.itneck.test',
        ])
        ->assertOk()
        ->assertJsonPath('data.display_name', 'ITneck Demo')
        ->assertJsonPath('data.meta.sending_domain', 'mail.itneck.test');

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/domains')
        ->assertOk()
        ->assertJsonPath('data.sending_domain', 'mail.itneck.test')
        ->assertJsonPath('data.guidance.domain', 'mail.itneck.test');

    Tenancy::end();
});
