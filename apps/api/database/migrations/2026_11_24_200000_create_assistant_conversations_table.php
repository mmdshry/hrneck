<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Central DB on purpose: a tool call carries only the conversation token, so the tenant
        // must be resolvable here before tenancy is initialized.
        Schema::create('assistant_conversations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id', 64);
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('copilot_conversation_id', 255);
            $table->text('direct_line_token');
            $table->string('watermark', 255)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'tenant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_conversations');
    }
};
