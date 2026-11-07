<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checklist_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('category', 32)->default('custom');
            $table->text('description')->nullable();
            $table->string('status', 16)->default('draft');
            $table->boolean('is_system')->default(false);
            $table->unsignedInteger('current_version')->default(0);
            $table->timestamps();
        });

        Schema::create('checklist_template_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('checklist_templates')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('schema_json');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['template_id', 'version']);
        });

        Schema::create('checklist_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('checklist_templates')->cascadeOnDelete();
            $table->foreignId('template_version_id')->constrained('checklist_template_versions')->restrictOnDelete();
            $table->foreignId('target_id')->constrained('targets')->cascadeOnDelete();
            $table->string('title');
            $table->string('status', 24)->default('not_started');
            $table->json('schema_snapshot');
            $table->unsignedTinyInteger('progress_pct')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('assigned_by')->nullable();
            $table->timestamps();

            $table->index(['template_id', 'target_id', 'status']);
            $table->index(['target_id', 'status']);
        });

        Schema::create('checklist_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instance_id')->constrained('checklist_instances')->cascadeOnDelete();
            $table->string('item_key', 120);
            $table->json('value_json')->nullable();
            $table->string('file_disk_path')->nullable();
            $table->string('file_mime', 120)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->unique(['instance_id', 'item_key']);
        });

        Schema::create('activity_log', function (Blueprint $table) {
            $table->id();
            $table->string('log_name')->nullable()->index();
            $table->text('description');
            $table->nullableMorphs('subject', 'subject');
            $table->string('event')->nullable();
            $table->nullableMorphs('causer', 'causer');
            $table->json('attribute_changes')->nullable();
            $table->json('properties')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_log');
        Schema::dropIfExists('checklist_answers');
        Schema::dropIfExists('checklist_instances');
        Schema::dropIfExists('checklist_template_versions');
        Schema::dropIfExists('checklist_templates');
    }
};
