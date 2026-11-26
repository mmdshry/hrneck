<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 64)->unique();
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('max_employees')->nullable();
            $table->unsignedInteger('max_users')->nullable();
            $table->json('features');
            $table->decimal('monthly_price', 10, 2)->nullable();
            $table->string('currency', 3)->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_plans');
    }
};
