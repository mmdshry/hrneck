<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('sd_stages')
            ->where('name', 'Resolved')
            ->update(['is_terminal' => true]);
    }

    public function down(): void
    {
        DB::table('sd_stages')
            ->where('name', 'Resolved')
            ->update(['is_terminal' => false]);
    }
};
