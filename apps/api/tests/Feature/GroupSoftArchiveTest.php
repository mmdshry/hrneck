<?php

use App\Domains\TargetsGroups\Models\Group;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('deleting a group soft-archives instead of hard delete', function () {
    $user = orgAdmin();

    $created = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/groups', ['name' => 'Archive Me'])
        ->assertCreated();

    $id = (int) $created->json('data.id');

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/groups/'.$id)
        ->assertOk();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $group = Group::query()->find($id);
    expect($group)->not->toBeNull();
    expect($group->status)->toBe('inactive');
    Tenancy::end();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/groups')
        ->assertOk()
        ->assertJsonMissing(['name' => 'Archive Me']);
});
