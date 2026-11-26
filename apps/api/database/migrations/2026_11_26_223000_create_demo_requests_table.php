<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demo_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('work_email', 191);
            $table->string('company', 160);
            $table->string('role', 32);
            $table->text('message')->nullable();
            $table->string('locale', 8)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demo_requests');
    }
};
