<?php

use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('forgot password always returns a generic success message and emails a reset link', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/password/forgot', [
        'email' => 'admin@itneck.test',
    ])
        ->assertOk()
        ->assertJsonPath('message', 'If that email is registered, a reset link has been sent.');

    Notification::assertSentTo(
        User::query()->where('email', 'admin@itneck.test')->firstOrFail(),
        ResetPassword::class,
    );

    Notification::assertCount(1);

    $this->postJson('/api/v1/auth/password/forgot', [
        'email' => 'nobody@example.test',
    ])
        ->assertOk()
        ->assertJsonPath('message', 'If that email is registered, a reset link has been sent.');

    Notification::assertCount(1);
});

test('reset password updates credentials with a valid token and rejects invalid tokens', function () {
    $user = User::query()->where('email', 'admin@itneck.test')->firstOrFail();
    $token = Password::broker()->createToken($user);

    $this->postJson('/api/v1/auth/password/reset', [
        'email' => 'admin@itneck.test',
        'token' => 'bad-token',
        'password' => 'NewPass!23456',
        'password_confirmation' => 'NewPass!23456',
    ])->assertStatus(422);

    $this->postJson('/api/v1/auth/password/reset', [
        'email' => 'admin@itneck.test',
        'token' => $token,
        'password' => 'NewPass!23456',
        'password_confirmation' => 'NewPass!23456',
    ])
        ->assertOk()
        ->assertJsonPath('message', 'Password has been reset.');

    expect(Hash::check('NewPass!23456', $user->fresh()->getAuthPassword()))->toBeTrue();

    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@itneck.test',
        'password' => 'NewPass!23456',
    ])->assertOk();
});
