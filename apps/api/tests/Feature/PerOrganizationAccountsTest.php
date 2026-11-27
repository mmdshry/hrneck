<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\EnsureTenantMembership;
use App\Domains\IdentityAccess\Actions\ProvisionEmployeePair;
use App\Domains\IdentityAccess\Actions\SeedRbacCatalog;
use App\Domains\IdentityAccess\Notifications\EmployeeInviteNotification;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Resources\Users\Pages\ManageUsers;
use App\Models\Tenant;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Facades\Tenancy;

function orgLogin(string $tenant, string $email, string $password): User
{
    return app(CreateOrgUser::class)->handle(
        $tenant,
        'Login '.$tenant,
        $email,
        $password,
        [OrgPermissionCatalog::ORG_ADMIN],
    );
}

test('one email can have a login in each organization but only one platform account', function () {
    orgLogin('itneck', 'scoped@example.test', 'DemoPass!234');
    orgLogin('company', 'scoped@example.test', 'DemoPass!234');

    expect(User::query()->withEmail('scoped@example.test')->count())->toBe(2);

    expect(fn () => orgLogin('itneck', 'SCOPED@example.test', 'DemoPass!234'))
        ->toThrow(ValidationException::class);

    User::factory()->create(['email' => 'platform.unique@example.test', 'tenant_id' => null]);

    expect(fn () => User::factory()->create(['email' => 'platform.unique@example.test', 'tenant_id' => null]))
        ->toThrow(QueryException::class);
});

test('an employee with a password can be created where the email already has a login elsewhere', function () {
    orgLogin('company', 'elsewhere@itneck.test', 'CompanyPass!234');

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'elsewhere@itneck.test',
            'first_name' => 'Else',
            'last_name' => 'Where',
            'password' => 'ItneckPass!234',
        ])
        ->assertCreated();

    $itneckLogin = User::query()->withEmail('elsewhere@itneck.test')->where('tenant_id', 'itneck')->firstOrFail();
    $companyLogin = User::query()->withEmail('elsewhere@itneck.test')->where('tenant_id', 'company')->firstOrFail();

    expect(Hash::check('ItneckPass!234', $itneckLogin->getAuthPassword()))->toBeTrue();
    expect(Hash::check('CompanyPass!234', $companyLogin->getAuthPassword()))->toBeTrue();
});

test('a password reset changes only the organization login it was issued for', function () {
    $email = 'reset.scope@example.test';
    $itneck = orgLogin('itneck', $email, 'DemoPass!234');
    $company = orgLogin('company', $email, 'DemoPass!234');

    $token = Password::broker()->createToken($itneck);

    $this->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/auth/password/reset', [
            'token' => $token,
            'email' => $email,
            'tenant' => 'itneck',
            'password' => 'NewItneck!234',
            'password_confirmation' => 'NewItneck!234',
        ])
        ->assertOk();

    expect(Hash::check('NewItneck!234', $itneck->fresh()->getAuthPassword()))->toBeTrue();
    expect(Hash::check('DemoPass!234', $company->fresh()->getAuthPassword()))->toBeTrue();
});

test('a reset without an organization address cannot change an organization login', function () {
    $email = 'single.login@example.test';
    $login = orgLogin('itneck', $email, 'DemoPass!234');

    $token = Password::broker()->createToken($login);

    // Organization logins are reset on the organization's own address, even when the email has only one login.
    $this->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/auth/password/reset', [
            'token' => $token,
            'email' => $email,
            'password' => 'NewSingle!234',
            'password_confirmation' => 'NewSingle!234',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['tenant']);

    expect(Hash::check('DemoPass!234', $login->fresh()->getAuthPassword()))->toBeTrue();
});

test('forgot password sends a reset link only to the chosen organization login', function () {
    Notification::fake();

    $email = 'forgot.scope@example.test';
    $itneck = orgLogin('itneck', $email, 'DemoPass!234');
    $company = orgLogin('company', $email, 'DemoPass!234');

    $this->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/auth/password/forgot', [
            'email' => $email,
            'tenant' => 'company',
        ])
        ->assertOk();

    Notification::assertSentTo($company, ResetPassword::class, function (ResetPassword $notification) use ($company): bool {
        $url = $notification->toMail($company)->actions[0]['url'];

        return str_contains($url, 'tenant=company')
            && str_contains($url, 'email=forgot.scope%40example.test');
    });
    Notification::assertNotSentTo($itneck, ResetPassword::class);
});

test('employee invite links name the organization login', function () {
    $user = User::factory()->create([
        'email' => 'invite.scope@example.test',
        'tenant_id' => 'company',
    ]);

    $url = (new EmployeeInviteNotification('invite-token'))->toMail($user)->actions[0]['url'];

    expect($url)->toContain('tenant=company')
        ->toContain('invite=1')
        ->toContain('email=invite.scope%40example.test');
});

test('provisioning an employee in another organization creates that organization login only', function () {
    $email = 'provision.scope@example.test';
    $itneck = orgLogin('itneck', $email, 'DemoPass!234');

    Tenancy::initialize(Tenant::query()->findOrFail('company'));
    try {
        $target = Target::query()->create([
            'email' => $email,
            'first_name' => 'Provision',
            'last_name' => 'Scope',
            'status' => 'active',
            'joined_via' => 'manual',
        ]);
    } finally {
        Tenancy::end();
    }

    Tenancy::initialize(Tenant::query()->findOrFail('company'));
    try {
        $result = app(ProvisionEmployeePair::class)->ensureUserForTarget($target, 'company', queueInvite: false);
    } finally {
        Tenancy::end();
    }

    expect($result['user']->id)->not->toBe($itneck->id);
    expect($result['user']->tenant_id)->toBe('company');
    expect($itneck->fresh()->tenant_id)->toBe('itneck');
});

test('a platform super admin can assign roles to a new employee in an entered organization', function () {
    // Regression: the platform staff check used to load roles under the entered organization's team,
    // which made role assignment fail with "You need permission to manage users to assign roles."
    $staff = platformAdmin();
    $origin = ['Origin' => 'http://hrneck.test'];

    $this->actingAs($staff)
        ->withHeaders($origin)
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    $this->actingAs($staff)
        ->withHeaders($origin + ['X-Tenant' => 'itneck'])
        ->postJson('/api/v1/org/targets', [
            'email' => 'staff.roles@itneck.test',
            'first_name' => 'Staff',
            'last_name' => 'Roles',
            'roles' => [OrgPermissionCatalog::LEARNER],
        ])
        ->assertCreated();

    $login = User::query()->withEmail('staff.roles@itneck.test')->where('tenant_id', 'itneck')->firstOrFail();

    setPermissionsTeamId('itneck');
    expect($login->fresh()->hasRole(OrgPermissionCatalog::LEARNER))->toBeTrue();
    setPermissionsTeamId(null);
    app(PermissionRegistrar::class)->forgetCachedPermissions();
});

test('an employee with a password can be created for an email that belongs to a platform staff account', function () {
    $email = 'staff.employee@itneck.test';
    User::factory()->create(['email' => $email, 'tenant_id' => null]);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => $email,
            'first_name' => 'Staff',
            'last_name' => 'Employee',
            'password' => 'ItneckPass!234',
        ])
        ->assertCreated();

    expect(User::query()->withEmail($email)->where('tenant_id', 'itneck')->exists())->toBeTrue();
});

test('the MSP user form accepts an email that another organization already uses', function () {
    Filament::setCurrentPanel(Filament::getPanel('admin'));
    $email = 'msp.other.org@example.test';
    orgLogin('itneck', $email, 'DemoPass!234');

    Livewire::actingAs(platformAdmin())
        ->test(ManageUsers::class)
        ->callAction('create', data: [
            'name' => 'Company Admin',
            'email' => $email,
            'password' => 'CompanyPass!234',
            'tenant_id' => 'company',
        ])
        ->assertHasNoActionErrors();

    expect(User::query()->withEmail($email)->where('tenant_id', 'company')->exists())->toBeTrue();
});

test('the MSP user form rejects an email that the same organization already uses', function () {
    Filament::setCurrentPanel(Filament::getPanel('admin'));
    $email = 'msp.same.org@example.test';
    orgLogin('itneck', $email, 'DemoPass!234');

    Livewire::actingAs(platformAdmin())
        ->test(ManageUsers::class)
        ->callAction('create', data: [
            'name' => 'Duplicate',
            'email' => $email,
            'password' => 'DuplicatePass!234',
            'tenant_id' => 'itneck',
        ])
        ->assertHasActionErrors(['email']);

    expect(User::query()->withEmail($email)->count())->toBe(1);
});

test('the MSP user form rejects an email that another platform staff account already uses', function () {
    Filament::setCurrentPanel(Filament::getPanel('admin'));
    $email = 'msp.platform.dup@example.test';
    User::factory()->create(['email' => $email, 'tenant_id' => null]);

    Livewire::actingAs(platformAdmin())
        ->test(ManageUsers::class)
        ->callAction('create', data: [
            'name' => 'Staff Duplicate',
            'email' => $email,
            'password' => 'StaffPass!234',
        ])
        ->assertHasActionErrors(['email']);
});

test('split command gives each organization its own login for a shared account', function () {
    $email = 'legacy.shared@example.test';
    $legacy = orgLogin('itneck', $email, 'DemoPass!234');

    // Pre-migration shape: one login that also has a membership in another organization.
    app(EnsureTenantMembership::class)->handle($legacy, 'company', ['department' => 'Sales']);
    app(SeedRbacCatalog::class)->ensureLearnerRole('company');
    setPermissionsTeamId('company');
    $legacy->assignRole(OrgPermissionCatalog::LEARNER);
    setPermissionsTeamId(null);

    Tenancy::initialize(Tenant::query()->findOrFail('company'));
    try {
        $target = Target::query()->create([
            'email' => $email,
            'first_name' => 'Legacy',
            'last_name' => 'Shared',
            'status' => 'active',
            'joined_via' => 'manual',
        ]);
        $target->forceFill(['user_id' => $legacy->id])->save();
        $targetId = $target->id;
    } finally {
        Tenancy::end();
    }

    $this->artisan('users:split-shared-accounts')->assertSuccessful();

    $legacy->refresh();
    expect($legacy->tenant_id)->toBe('itneck');
    expect($legacy->belongsToTenant('company'))->toBeFalse();

    $companyLogin = User::query()->withEmail($email)->where('tenant_id', 'company')->firstOrFail();
    expect($companyLogin->id)->not->toBe($legacy->id);
    expect($companyLogin->getAuthPassword())->toBe($legacy->getAuthPassword());
    expect($companyLogin->belongsToTenant('company'))->toBeTrue();

    setPermissionsTeamId('company');
    expect($companyLogin->fresh()->hasRole(OrgPermissionCatalog::LEARNER))->toBeTrue();
    expect($legacy->fresh()->hasRole(OrgPermissionCatalog::LEARNER))->toBeFalse();
    setPermissionsTeamId(null);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    Tenancy::initialize(Tenant::query()->findOrFail('company'));
    try {
        expect(Target::query()->whereKey($targetId)->value('user_id'))->toBe($companyLogin->id);
    } finally {
        Tenancy::end();
    }
});
