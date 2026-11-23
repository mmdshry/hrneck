<?php

use App\Support\AppLocale;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('targets') || ! Schema::hasColumn('targets', 'preferred_language')) {
            return;
        }

        $allowed = AppLocale::ALLOWED;
        $placeholders = implode(',', array_fill(0, count($allowed), '?'));

        DB::table('targets')
            ->whereNotNull('preferred_language')
            ->where('preferred_language', '!=', '')
            ->whereRaw("preferred_language NOT IN ({$placeholders})", $allowed)
            ->update(['preferred_language' => AppLocale::DEFAULT]);
    }

    public function down(): void
    {
        // Irreversible data normalization.
    }
};
