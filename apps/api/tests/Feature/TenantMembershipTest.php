<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\EnsureTenantMembership;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\TenantMembership;
use App\Models\User;
use App\Support\ActiveOrgTenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('same email can hold memberships in multiple tenants', function () {
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

    expect($first->id)->toBe($second->id);
    expect(User::query()->whereRaw('LOWER(email) = ?', [$email])->count())->toBe(1);
    expect(TenantMembership::query()->where('user_id', $first->id)->count())->toBe(2);
    expect($first->fresh()->belongsToTenant('itneck'))->toBeTrue();
    expect($first->fresh()->belongsToTenant('company'))->toBeTrue();
});

test('login with multiple memberships requires org selection until enter', function () {
    $email = 'multi@example.test';
    $password = 'DemoPass!234';

    app(CreateOrgUser::class)->handle('itneck', 'Multi', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Multi', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $login = $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
        ])
        ->assertOk()
        ->assertJsonPath('data.needs_org_selection', true);

    expect($login->json('data.memberships'))->toHaveCount(2);
    expect($login->json('data.tenant_id'))->toBeNull();

    $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->firstOrFail();

    $this->actingAs($user)
        ->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/itneck/enter')
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'itneck')
        ->assertJsonPath('data.needs_org_selection', false);

    expect(ActiveOrgTenant::id())->toBe('itneck');

    $this->actingAs($user)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/users')
        ->assertOk();

    $this->actingAs($user)
        ->withHeaders($origin)
        ->postJson('/api/v1/auth/orgs/company/enter')
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'company');

    $this->actingAs($user)
        ->withHeaders($origin + ['X-Tenant' => 'company'])
        ->getJson('/api/v1/org/users')
        ->assertOk();

    $this->actingAs($user)
        ->withHeaders($origin + ['X-Tenant' => 'test'])
        ->getJson('/api/v1/org/users')
        ->assertForbidden();
});

test('provisioning an employee in a second org reuses the same user', function () {
    $email = 'employee.shared@example.test';

    app(CreateOrgUser::class)->handle(
        'itneck',
        'Employee Shared',
        $email,
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    try {
        Tenancy::initialize(\App\Models\Tenant::query()->findOrFail('company'));
        $target = Target::query()->create([
            'email' => $email,
            'first_name' => 'Emp',
            'last_name' => 'Shared',
            'status' => 'active',
            'joined_via' => 'manual',
        ]);

        $result = app(\App\Domains\IdentityAccess\Actions\ProvisionEmployeePair::class)
            ->ensureUserForTarget($target, 'company');

        expect($result['created'])->toBeFalse();
        expect($result['user']->email)->toBe($email);
        expect($result['user']->belongsToTenant('itneck'))->toBeTrue();
        expect($result['user']->belongsToTenant('company'))->toBeTrue();
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
    ))->toThrow(\Illuminate\Validation\ValidationException::class);
});

test('disabled membership blocks that tenant only', function () {
    $email = 'partial.disable@example.test';
    $password = 'DemoPass!234';

    $user = app(CreateOrgUser::class)->handle('itneck', 'Partial', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Partial', $email, $password, [OrgPermissionCatalog::ORG_ADMIN]);

    TenantMembership::query()
        ->where('user_id', $user->id)
        ->where('tenant_id', 'itneck')
        ->update(['disabled_at' => now()]);

    $origin = ['Origin' => 'http://hrneck.test'];

    $this->withHeaders($origin)
        ->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
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
