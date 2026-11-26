<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistant_pending_actions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('conversation_id');
            $table->unsignedBigInteger('user_id');
            $table->string('tool', 64);
            $table->json('input');
            $table->string('summary', 500);
            $table->string('status', 16)->default('pending');
            $table->json('result')->nullable();
            $table->string('failure_reason', 255)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'status']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_pending_actions');
    }
};
