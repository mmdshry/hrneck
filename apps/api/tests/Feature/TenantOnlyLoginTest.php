<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Tenancy\Support\TenantAddress;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

// Organization accounts sign in only on their organization's address (the `tenant` field).
// Platform staff sign in only on the staff host (`scope=platform`).

test('an organization login without an organization address is refused', function () {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@itneck.test',
        'password' => 'DemoPass!234',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['tenant']);
});

test('an unknown organization address is refused', function () {
    $this->postJson('/api/v1/auth/login', tenantLoginBody('nobody-here', 'admin@itneck.test', 'DemoPass!234'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['tenant']);
});

test('a password from another organization does not open this organization address', function () {
    $email = 'other.org.password@example.test';
    app(CreateOrgUser::class)->handle('itneck', 'Other', $email, 'DemoPass!234', [OrgPermissionCatalog::ORG_ADMIN]);
    app(CreateOrgUser::class)->handle('company', 'Other', $email, 'OtherPass!234', [OrgPermissionCatalog::ORG_ADMIN]);

    $this->postJson('/api/v1/auth/login', tenantLoginBody('company', $email, 'DemoPass!234'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('platform staff cannot sign in through an organization address', function () {
    $this->postJson('/api/v1/auth/login', tenantLoginBody('itneck', platformAdmin()->email, 'DemoPass!234'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('an organization account cannot sign in on the staff host', function () {
    $this->postJson('/api/v1/auth/login', staffLoginBody('admin@itneck.test', 'DemoPass!234'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('a staff host login needs a platform role, not only a password', function () {
    $user = User::query()->create([
        'name' => 'No Role',
        'email' => 'no.role.staff@example.test',
        'password' => Hash::make('DemoPass!234'),
        'tenant_id' => null,
    ]);
    $user->forceFill(['email_verified_at' => now()])->save();

    $this->postJson('/api/v1/auth/login', staffLoginBody($user->email, 'DemoPass!234'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

test('scope must be tenant or platform', function () {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@itneck.test',
        'password' => 'DemoPass!234',
        'scope' => 'admin',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['scope']);
});

test('the organization lookup returns the sign-in address of an organization', function () {
    $this->getJson('/api/v1/auth/organizations/itneck')
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'itneck')
        ->assertJsonPath('data.login_url', app(TenantAddress::class)->loginUrl('itneck'));
});

test('the organization lookup ignores case and refuses unknown organizations', function () {
    $this->getJson('/api/v1/auth/organizations/ITNECK')
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'itneck');

    $this->getJson('/api/v1/auth/organizations/nobody-here')
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});

test('forgot password needs an organization address or the staff scope', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/password/forgot', ['email' => 'admin@itneck.test'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['tenant']);

    Notification::assertNothingSent();
});

test('a staff host forgot password does not email an organization account', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/password/forgot', [
        'email' => 'admin@itneck.test',
        'scope' => 'platform',
    ])->assertOk();

    Notification::assertNotSentTo(
        User::query()->where('email', 'admin@itneck.test')->firstOrFail(),
        ResetPassword::class,
    );
});

test('a staff host reset cannot change an organization password', function () {
    $user = User::query()->where('email', 'admin@itneck.test')->firstOrFail();
    $token = Password::broker()->createToken($user);

    $this->postJson('/api/v1/auth/password/reset', [
        'email' => 'admin@itneck.test',
        'token' => $token,
        'password' => 'NewPass!23456',
        'password_confirmation' => 'NewPass!23456',
        'scope' => 'platform',
    ])->assertStatus(422);

    expect(Hash::check('NewPass!23456', $user->fresh()->getAuthPassword()))->toBeFalse();
});
