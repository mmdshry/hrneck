<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checklist_packs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('status', 16)->default('draft');
            $table->boolean('auto_assign_on_create')->default(false);
            $table->timestamps();
        });

        Schema::create('checklist_pack_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pack_id')->constrained('checklist_packs')->cascadeOnDelete();
            $table->foreignId('template_id')->constrained('checklist_templates')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['pack_id', 'template_id']);
            $table->index(['pack_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_pack_items');
        Schema::dropIfExists('checklist_packs');
    }
};
