<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy module flag column already omitted from historical tenant profile migration.
    }

    public function down(): void
    {
        //
    }
};
