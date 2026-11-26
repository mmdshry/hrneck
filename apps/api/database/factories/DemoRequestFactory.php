<?php

namespace Database\Factories;

use App\Domains\DemoRequests\Models\DemoRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DemoRequest>
 */
class DemoRequestFactory extends Factory
{
    protected $model = DemoRequest::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'work_email' => fake()->unique()->safeEmail(),
            'company' => fake()->company(),
            'role' => fake()->randomElement(['msp', 'organization', 'other']),
            'message' => fake()->optional()->sentence(),
            'locale' => 'en',
            'ip_address' => fake()->ipv4(),
        ];
    }
}
