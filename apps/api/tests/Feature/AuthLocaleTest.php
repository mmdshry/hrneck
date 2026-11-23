<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

test('authenticated user can update locale preference', function () {
    $user = User::factory()->create([
        'password' => Hash::make('DemoPass!234'),
        'locale' => 'en',
    ]);
    $user->forceFill([
        'email_verified_at' => now(),
        'mfa_enabled' => false,
    ])->save();

    $this->actingAs($user)
        ->putJson('/api/v1/auth/locale', ['locale' => 'es'])
        ->assertOk()
        ->assertJsonPath('data.locale', 'es')
        ->assertJsonPath('data.email', $user->email);

    expect($user->fresh()->locale)->toBe('es');
});

test('update locale rejects unsupported values', function () {
    $user = User::factory()->create([
        'password' => Hash::make('DemoPass!234'),
    ]);
    $user->forceFill([
        'email_verified_at' => now(),
        'mfa_enabled' => false,
    ])->save();

    $this->actingAs($user)
        ->putJson('/api/v1/auth/locale', ['locale' => 'zh'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['locale']);
});

test('update locale requires authentication', function () {
    $this->putJson('/api/v1/auth/locale', ['locale' => 'fr'])
        ->assertUnauthorized();
});
