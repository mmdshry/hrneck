<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Stored as columns (not computed attributes) so the learner live snapshot,
        // which replaces the enrollment list wholesale, always carries them.
        Schema::table('enrollments', function (Blueprint $table) {
            $table->timestamp('attested_at')->nullable();
            $table->boolean('attestation_pending')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn(['attested_at', 'attestation_pending']);
        });
    }
};
