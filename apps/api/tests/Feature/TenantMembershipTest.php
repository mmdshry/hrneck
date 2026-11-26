<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\EnsureTenantMembership;
use App\Domains\IdentityAccess\Actions\ProvisionEmployeePair;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use App\Support\ActiveOrgTenant;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Facades\Tenancy;

test('same email can hold a separate login in each organization', function () {
    $email = 'shared@example.test';

    $first = app(CreateOrgUser::class)->handle(
        'itneck',
        'Shared User',
        $email,
        'DemoPass!234',
        [OrgPermissionCatalog::ORG_ADMIN],
    );

    $second = app(CreateOrgUser::class)->handle(
        'company',
        'Shared User',
        $email,
        'IgnoredPass!234',
        [OrgPermissionCatalog::ORG_ADMIN],
    );

    expect($first->id)->not->toBe($second->id);
    expect(User::query()->withEmail($email)->count())->toBe(2);
    expect($first->fresh()->tenant_id)->toBe('itneck');
    expect($second->fresh()->tenant_id)->toBe('company');
    expect($first->fresh()->belongsToTenant('company'))->toBeFalse();
    expect($second->fresh()->belongsToTenant('itneck'))->toBeFalse();
    expect(TenantMembership::query()->where('user_id', $first->id)->count())->toBe(1);
    expect(TenantMembership::query()->where('user_id', $second->id)->count())->toBe(1);
});

test('each organization login keeps its own password', function () {
    $email = 'multi@example.test';

    app(CreateOrgUser::class)->handle('itneck', 'Multi', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Multi', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'OtherPass!234',
        ])
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'company')
        ->assertJsonPath('data.needs_org_selection', false);

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'DemoPass!234',
        ])
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'itneck');

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'DemoPass!234',
            'tenant' => 'company',
        ])
        ->assertUnprocessable();

    $user = User::query()->withEmail($email)->where('tenant_id', 'itneck')->firstOrFail();

    $this->actingAs($user)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/users')
        ->assertOk();

    $this->actingAs($user)
        ->withHeaders($origin + ['X-Tenant' => 'company'])
        ->getJson('/api/v1/org/users')
        ->assertForbidden();
});

test('identical passwords across organizations are resolved by the organization address', function () {
    $email = 'twins@example.test';
    $password = 'DemoPass!234';

    app(CreateOrgUser::class)->handle('itneck', 'Twin', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Twin', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
            'tenant' => 'company',
        ])
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'company');
});

test('provisioning an employee in a second org creates a separate login', function () {
    $email = 'employee.shared@example.test';

    $first = app(CreateOrgUser::class)->handle(
        'itneck',
        'Employee Shared',
        $email,
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    try {
        Tenancy::initialize(Tenant::query()->findOrFail('company'));
        $target = Target::query()->create([
            'email' => $email,
            'first_name' => 'Emp',
            'last_name' => 'Shared',
            'status' => 'active',
            'joined_via' => 'manual',
        ]);

        $result = app(ProvisionEmployeePair::class)
            ->ensureUserForTarget($target, 'company', queueInvite: false);

        expect($result['created'])->toBeTrue();
        expect($result['user']->id)->not->toBe($first->id);
        expect($result['user']->email)->toBe($email);
        expect($result['user']->tenant_id)->toBe('company');
        expect($first->fresh()->belongsToTenant('company'))->toBeFalse();
        expect($target->fresh()->user_id)->toBe($result['user']->id);
    } finally {
        Tenancy::end();
    }
});

test('platform staff email cannot be linked as an org member', function () {
    $staff = platformAdmin();

    expect(fn () => app(CreateOrgUser::class)->handle(
        'itneck',
        'Nope',
        $staff->email,
        'DemoPass!234',
        [OrgPermissionCatalog::ORG_ADMIN],
    ))->toThrow(ValidationException::class);
});

test('disabled membership blocks that organization login only', function () {
    $email = 'partial.disable@example.test';
    $password = 'DemoPass!234';

    $itneckLogin = app(CreateOrgUser::class)->handle('itneck', 'Partial', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Partial', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);

    TenantMembership::query()
        ->where('user_id', $itneckLogin->id)
        ->where('tenant_id', 'itneck')
        ->update(['disabled_at' => now()]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
            'tenant' => 'company',
        ])
        ->assertOk();

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/itneck/enter')
        ->assertForbidden();

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/enter')
        ->assertOk();

    $this->withHeaders($origin + ['X-Tenant' => 'company'])
        ->getJson('/api/v1/org/users')
        ->assertOk();

    $this->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/users')
        ->assertForbidden();

    expect(ActiveOrgTenant::id())->toBe('company');
});

test('demo seeder backfills memberships for org users', function () {
    $admin = User::query()->where('email', 'admin@itneck.test')->first();
    expect($admin)->not->toBeNull();
    expect($admin->belongsToTenant('itneck'))->toBeTrue();
    expect(TenantMembership::query()->where('user_id', $admin->id)->where('tenant_id', 'itneck')->exists())->toBeTrue();
});

test('ensure tenant membership reactivates a disabled row', function () {
    $user = User::factory()->create([
        'tenant_id' => 'itneck',
        'password' => Hash::make('DemoPass!234'),
    ]);

    $membership = TenantMembership::query()->where('user_id', $user->id)->where('tenant_id', 'itneck')->first();
    expect($membership)->not->toBeNull();
    $membership->forceFill(['disabled_at' => now()])->save();

    app(EnsureTenantMembership::class)->handle($user, 'itneck');

    expect($membership->fresh()->disabled_at)->toBeNull();
});
