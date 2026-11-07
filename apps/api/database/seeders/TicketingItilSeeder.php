<?php

namespace Database\Seeders;

use App\Domains\Ticketing\Actions\SeedItilDesks;
use Illuminate\Database\Seeder;

class TicketingItilSeeder extends Seeder
{
    public function run(): void
    {
        app(SeedItilDesks::class)->handle();
    }
}
