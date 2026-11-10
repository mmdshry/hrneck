<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('demo admin can login without mfa', function () {
    $user = User::query()->updateOrCreate(
        ['email' => 'admin@hrneck.test'],
        [
            'name' => 'HRNECK Admin',
            'password' => Hash::make('DemoPass!234'),
        ],
    );
    $user->forceFill([
        'email_verified_at' => now(),
        'mfa_enabled' => false,
    ])->save();

    $response = $this->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'DemoPass!234',
        ]);

    $response->assertOk()->assertJsonPath('mfa_required', false);

    $this->withHeader('Origin', 'http://hrneck.test')
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.email', $user->email);
});

test('unverified users cannot login', function () {
    $user = User::factory()->unverified()->create([
        'password' => Hash::make('DemoPass!234'),
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('bad password returns generic validation error', function () {
    $user = User::factory()->create([
        'password' => Hash::make('DemoPass!234'),
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});
