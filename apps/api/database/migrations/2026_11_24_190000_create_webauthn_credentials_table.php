<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webauthn_credentials', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // Raw credential ID (spec max 1023 bytes). Unique across all users.
            $table->binary('credential_id', 1023)->unique();
            // COSE-encoded public key.
            $table->binary('public_key');
            $table->unsignedBigInteger('counter')->default(0);
            $table->string('name', 100);
            $table->json('transports')->nullable();
            $table->string('aaguid', 36)->nullable();
            $table->string('attestation_type', 32)->default('none');
            $table->boolean('backup_eligible')->nullable();
            $table->boolean('backup_status')->nullable();
            $table->boolean('uv_initialized')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webauthn_credentials');
    }
};
