<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Jobs\SendEmployeeInviteJob;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('creating a target provisions a learner user and queues invite', function () {
    Queue::fake();

    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'New.Hire@Example.TEST',
            'first_name' => 'New',
            'last_name' => 'Hire',
        ])
        ->assertCreated()
        ->assertJsonPath('meta.login_invited', true);

    $user = User::query()->whereRaw('LOWER(email) = ?', ['new.hire@example.test'])->first();
    expect($user)->not->toBeNull();
    expect($user->tenant_id)->toBe('itneck');
    expect($user->must_set_password)->toBeTrue();

    setPermissionsTeamId('itneck');
    expect($user->hasRole(OrgPermissionCatalog::LEARNER))->toBeTrue();
    expect($user->can(OrgPermissionCatalog::TICKETING_PORTAL))->toBeTrue();
    setPermissionsTeamId(null);

    Queue::assertPushed(SendEmployeeInviteJob::class);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Target::query()->where('email', 'new.hire@example.test')->exists())->toBeTrue();
    Tenancy::end();
});

test('creating a learner org user creates a matching target', function () {
    $user = app(CreateOrgUser::class)->handle(
        'itneck',
        'Learner Only',
        'learner.only@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    expect($user->must_set_password)->toBeFalse();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->whereRaw('LOWER(email) = ?', ['learner.only@itneck.test'])->first();
    expect($target)->not->toBeNull();
    expect($target->status)->toBe('active');
    Tenancy::end();
});

test('creating org admin does not create a target', function () {
    app(CreateOrgUser::class)->handle(
        'itneck',
        'Ops Only',
        'ops.only@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::ORG_ADMIN],
    );

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Target::query()->whereRaw('LOWER(email) = ?', ['ops.only@itneck.test'])->exists())->toBeFalse();
    Tenancy::end();
});

test('inactive target blocks learn assignments', function () {
    Queue::fake();
    $admin = orgAdmin();

    $create = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'inactive.learn@itneck.test',
            'first_name' => 'In',
            'last_name' => 'Active',
        ])
        ->assertCreated();

    $targetId = (int) $create->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/targets/'.$targetId, ['status' => 'inactive'])
        ->assertOk();

    $learner = User::query()->where('email', 'inactive.learn@itneck.test')->firstOrFail();
    $learner->forceFill([
        'must_set_password' => false,
        'password' => 'DemoPass!234',
    ])->save();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/training/assignments')
        ->assertStatus(422);
});

test('must_set_password blocks login until invite reset', function () {
    $learner = User::query()->create([
        'name' => 'Invite Block',
        'email' => 'invite.block@itneck.test',
        'password' => 'DemoPass!234',
        'tenant_id' => 'itneck',
        'must_set_password' => true,
    ]);
    $learner->forceFill(['email_verified_at' => now()])->save();

    expect($learner->fresh()->must_set_password)->toBeTrue();

    $this->postJson('/api/v1/auth/login', [
        'email' => 'invite.block@itneck.test',
        'password' => 'DemoPass!234',
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});
