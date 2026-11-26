<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Targets no longer carry their own timezone. All recorded times are presented
// in the tenant timezone stored in organization_settings.timezone.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('targets') || ! Schema::hasColumn('targets', 'timezone')) {
            return;
        }

        Schema::table('targets', function (Blueprint $table): void {
            $table->dropColumn('timezone');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('targets') || Schema::hasColumn('targets', 'timezone')) {
            return;
        }

        Schema::table('targets', function (Blueprint $table): void {
            $table->string('timezone', 64)->nullable()->after('preferred_language');
        });
    }
};
