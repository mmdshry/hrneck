<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->boolean('is_remedial')->default(false)->after('type');
        });

        Schema::create('training_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->string('campaign_name');
            $table->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            $table->string('course_title');
            $table->foreignId('target_id')->nullable()->constrained()->nullOnDelete();
            $table->string('target_name');
            $table->string('target_email');
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            $table->string('group_name');
            $table->foreignId('enrollment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recipient_id')->nullable()->constrained('campaign_recipients')->nullOnDelete();
            $table->boolean('is_remedial')->default(false);
            $table->string('status')->default('no_action');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['campaign_id', 'course_id', 'target_id'], 'training_assignments_campaign_course_target');
            $table->index('is_remedial');
        });

        Schema::create('training_assignment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('training_assignment_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16);
            $table->timestamp('occurred_at');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['training_assignment_id', 'type'], 'training_assignment_events_type_unique');
            $table->index('occurred_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('training_assignment_events');
        Schema::dropIfExists('training_assignments');

        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('is_remedial');
        });
    }
};
