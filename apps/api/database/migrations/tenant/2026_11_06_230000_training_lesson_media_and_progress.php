<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->string('content_type', 16)->default('text')->after('title');
            $table->string('media_url')->nullable()->after('body');
            $table->string('media_disk_path')->nullable()->after('media_url');
            $table->string('media_mime', 120)->nullable()->after('media_disk_path');
            $table->unsignedBigInteger('media_size')->nullable()->after('media_mime');
            $table->unsignedInteger('duration_seconds')->nullable()->after('media_size');
        });

        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->string('status', 32)->default('not_started');
            $table->unsignedTinyInteger('progress_pct')->default(0);
            $table->unsignedInteger('watched_seconds')->default(0);
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['enrollment_id', 'lesson_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_progress');

        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn([
                'content_type',
                'media_url',
                'media_disk_path',
                'media_mime',
                'media_size',
                'duration_seconds',
            ]);
        });
    }
};
