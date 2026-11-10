<?php

use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('org users list accepts q and name filters', function () {
    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Filter Alice',
            'email' => 'filter.alice@itneck.test',
            'password' => 'DemoPass!234',
            'roles' => ['org_admin'],
        ])
        ->assertCreated();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/users?q=filter.alice')
        ->assertOk()
        ->assertJsonFragment(['email' => 'filter.alice@itneck.test']);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/users?name=Filter%20Alice')
        ->assertOk()
        ->assertJsonFragment(['email' => 'filter.alice@itneck.test']);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/users?q=zzznomatch')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('org targets list accepts q and department filters', function () {
    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'dept.filter@itneck.test',
            'first_name' => 'Dept',
            'last_name' => 'Filter',
            'department' => 'Security-Filter-Lab',
        ])
        ->assertCreated();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets?q=dept.filter')
        ->assertOk()
        ->assertJsonFragment(['email' => 'dept.filter@itneck.test']);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets?department=Security-Filter-Lab')
        ->assertOk()
        ->assertJsonFragment(['email' => 'dept.filter@itneck.test']);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets?department=NoSuchDepartmentXYZ')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('ticketing tickets list accepts column filters', function () {
    $admin = orgAdmin();

    $desks = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/desks?per_page=100')
        ->assertOk()
        ->json('data');

    $deskId = collect($desks)->firstWhere('type', 'incident')['id']
        ?? collect($desks)->first()['id']
        ?? null;
    expect($deskId)->not->toBeNull();

    $summary = 'ListQuery ticket '.uniqid();
    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => $summary,
        ])
        ->assertCreated()
        ->json('data');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets?summary='.urlencode($summary))
        ->assertOk()
        ->assertJsonFragment(['summary' => $summary]);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets?number='.urlencode((string) $created['number']))
        ->assertOk()
        ->assertJsonFragment(['number' => $created['number']]);
});

test('msp tenants list accepts q and status filters', function () {
    $msp = platformAdmin();

    $this->actingAs($msp)
        ->getJson('/api/v1/msp/tenants?q=itneck')
        ->assertOk()
        ->assertJsonFragment(['id' => 'itneck']);

    $this->actingAs($msp)
        ->getJson('/api/v1/msp/tenants?status=active')
        ->assertOk();

    $this->actingAs($msp)
        ->getJson('/api/v1/msp/tenants?q=definitely-missing-tenant-xyz')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
