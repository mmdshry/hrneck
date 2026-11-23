<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('target_import_mappings', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->json('column_map');
            $table->timestamps();

            $table->unique('name');
        });

        Schema::create('target_import_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('disk_path');
            $table->string('original_filename', 255);
            $table->json('headers');
            $table->json('sample_rows');
            $table->unsignedInteger('row_count')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('target_import_sessions');
        Schema::dropIfExists('target_import_mappings');
    }
};
