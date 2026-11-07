<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sending_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('from_name');
            $table->string('from_email');
            $table->string('mailer')->default('smtp');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('report_archives', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('scope'); // business|user
            $table->string('period_type'); // monthly|quarterly|custom
            $table->string('period_key'); // 2026-09 or 2026-Q3
            $table->string('format')->default('pdf');
            $table->string('disk_path');
            $table->string('timezone')->default('UTC');
            $table->json('options')->nullable();
            $table->string('status')->default('ready');
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();
        });

        Schema::table('enrollments', function (Blueprint $table) {
            if (! Schema::hasColumn('enrollments', 'opened_at')) {
                $table->timestamp('opened_at')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            if (Schema::hasColumn('enrollments', 'opened_at')) {
                $table->dropColumn('opened_at');
            }
        });
        Schema::dropIfExists('report_archives');
        Schema::dropIfExists('sending_profiles');
    }
};
