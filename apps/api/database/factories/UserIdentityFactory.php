<?php

namespace Database\Factories;

use App\Domains\IdentityAccess\Support\SsoProvider;
use App\Models\User;
use App\Models\UserIdentity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserIdentity>
 */
class UserIdentityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'provider' => SsoProvider::Google,
            'subject' => fake()->unique()->numerify('##################'),
            'email' => fake()->unique()->safeEmail(),
            'linked_at' => now(),
        ];
    }

    public function microsoft(): static
    {
        return $this->state(fn (array $attributes) => [
            'provider' => SsoProvider::Microsoft,
        ]);
    }
}
