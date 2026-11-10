<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_recipients', function (Blueprint $table) {
            $table->dropUnique(['tracking_token']);
            $table->dropColumn([
                'tracking_token',
                'clicked_at',
                'submitted_at',
                'reported_at',
            ]);
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn(['randomize_send', 'meta']);
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->boolean('randomize_send')->default(false);
            $table->json('meta')->nullable();
        });

        Schema::table('campaign_recipients', function (Blueprint $table) {
            $table->string('tracking_token', 64)->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reported_at')->nullable();
        });
    }
};
