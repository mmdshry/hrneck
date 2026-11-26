<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Spatie\Permission\Models\Role;
use Stancl\Tenancy\Facades\Tenancy;

test('a login with only the learner role is an employee without org access', function () {
    $user = app(CreateOrgUser::class)->handle(
        'itneck',
        'Learner Only',
        'learner.only@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    $this->actingAs($user)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.has_org_access', false);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->where('user_id', $user->id)->first();
    expect($target)->not->toBeNull()
        ->and($target->joined_via)->toBe('account');
    Tenancy::end();
});

test('an org admin has org access', function () {
    $this->actingAs(orgAdmin())
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.has_org_access', true);
});

test('employee payload lists the roles of the linked login', function () {
    $user = app(CreateOrgUser::class)->handle(
        'itneck',
        'Role Listed',
        'role.listed@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $targetId = (int) Target::query()->where('user_id', $user->id)->value('id');
    Tenancy::end();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets/'.$targetId)
        ->assertOk()
        ->assertJsonPath('data.account_roles', [OrgPermissionCatalog::LEARNER]);
});

test('creating an employee with roles gives the new login those roles', function () {
    Queue::fake();

    $created = $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'hr.hire@itneck.test',
            'first_name' => 'Hr',
            'last_name' => 'Hire',
            'roles' => [OrgPermissionCatalog::LEARNER],
        ])
        ->assertCreated();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets/'.$created->json('data.id'))
        ->assertOk()
        ->assertJsonPath('data.account_roles', [OrgPermissionCatalog::LEARNER]);
});

test('assigning roles on employee create requires permission to manage users', function () {
    Queue::fake();

    $manager = app(CreateOrgUser::class)->handle(
        'itneck',
        'Targets Manager',
        'targets.manager@itneck.test',
        'DemoPass!234',
        [],
    );

    setPermissionsTeamId('itneck');
    $role = Role::create([
        'name' => 'targets_only_roles',
        'guard_name' => OrgPermissionCatalog::GUARD,
        config('permission.column_names.team_foreign_key') => 'itneck',
    ]);
    $role->syncPermissions([OrgPermissionCatalog::TARGETS_VIEW, OrgPermissionCatalog::TARGETS_MANAGE]);
    $manager->syncRoles([$role]);
    setPermissionsTeamId(null);

    $this->actingAs($manager)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'roles.blocked@itneck.test',
            'first_name' => 'Roles',
            'last_name' => 'Blocked',
            'roles' => [OrgPermissionCatalog::LEARNER],
        ])
        ->assertForbidden();

    expect(User::query()->where('email', 'roles.blocked@itneck.test')->exists())->toBeFalse();
});

test('backfill creates a target for an account without one and links an unlinked target by email', function () {
    $withoutTarget = app(CreateOrgUser::class)->handle(
        'itneck',
        'Backfill Missing',
        'backfill.missing@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );
    $withUnlinkedTarget = app(CreateOrgUser::class)->handle(
        'itneck',
        'Backfill Linked',
        'backfill.linked@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    DB::table('targets')->where('user_id', $withoutTarget->id)->delete();
    DB::table('targets')->where('user_id', $withUnlinkedTarget->id)->update(['user_id' => null]);

    $migration = require database_path('migrations/tenant/2026_11_26_100000_backfill_account_employee_targets.php');
    $migration->up();

    $missing = Target::query()->where('user_id', $withoutTarget->id)->first();
    expect($missing)->not->toBeNull()
        ->and($missing->email)->toBe('backfill.missing@itneck.test')
        ->and($missing->joined_via)->toBe('account');

    $linked = Target::query()->whereRaw('LOWER(email) = ?', ['backfill.linked@itneck.test'])->get();
    expect($linked)->toHaveCount(1)
        ->and($linked->first()->user_id)->toBe($withUnlinkedTarget->id);

    Tenancy::end();
});
