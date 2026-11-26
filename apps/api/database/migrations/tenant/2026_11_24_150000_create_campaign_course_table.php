<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_course', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->unique(['campaign_id', 'course_id']);
        });

        // Carry over the legacy single-course link. campaigns.course_id is kept
        // (no longer read or written) so this migration stays reversible.
        // Rows pointing at a course that no longer exists are skipped.
        DB::table('campaign_course')->insertUsing(
            ['campaign_id', 'course_id', 'sort_order'],
            DB::table('campaigns')
                ->join('courses', 'courses.id', '=', 'campaigns.course_id')
                ->select('campaigns.id', 'campaigns.course_id', DB::raw('0')),
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_course');
    }
};
