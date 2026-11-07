<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('targets', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('department')->nullable();
            $table->string('status')->default('active');
            $table->string('external_id')->nullable()->index();
            $table->unsignedTinyInteger('risk_score')->default(0);
            $table->timestamps();
        });

        Schema::create('groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('source')->default('manual');
            $table->string('external_id')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('group_target', function (Blueprint $table) {
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('target_id')->constrained()->cascadeOnDelete();
            $table->primary(['group_id', 'target_id']);
        });

        Schema::create('directory_connections', function (Blueprint $table) {
            $table->id();
            $table->string('driver'); // mock|entra|google
            $table->string('status')->default('ready');
            $table->json('config')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_target');
        Schema::dropIfExists('groups');
        Schema::dropIfExists('targets');
        Schema::dropIfExists('directory_connections');
    }
};
