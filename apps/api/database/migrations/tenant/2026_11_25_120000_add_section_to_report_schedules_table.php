<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Which report the scheduled CSV email carries. Existing schedules keep the
        // original eight-line summary, so the default matches their previous behavior.
        Schema::table('report_schedules', function (Blueprint $table) {
            $table->string('section', 40)->default('summary');
        });
    }

    public function down(): void
    {
        Schema::table('report_schedules', function (Blueprint $table) {
            $table->dropColumn('section');
        });
    }
};
