<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('demo admin can login without mfa', function () {
    $user = User::query()->updateOrCreate(
        ['email' => 'admin@hrneck.test'],
        [
            'name' => 'HRNECK Admin',
            'password' => Hash::make('DemoPass!234'),
            'mfa_enabled' => false,
        ],
    );

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'DemoPass!234',
    ]);

    $response->assertOk()->assertJsonPath('mfa_required', false);
});
