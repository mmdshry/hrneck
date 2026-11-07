<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sd_desks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('type', 32); // incident|problem|service_request|change|kb
            $table->string('number_prefix', 16)->default('TKT');
            $table->unsignedBigInteger('next_number')->default(1);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false);
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        Schema::create('sd_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('sequence')->default(0);
            $table->unsignedInteger('default_escalation_minutes')->nullable();
            $table->boolean('is_terminal')->default(false);
            $table->timestamps();

            $table->index(['desk_id', 'sequence']);
        });

        Schema::create('sd_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->nullable()->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug', 64);
            $table->boolean('is_closed')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['desk_id', 'slug']);
        });

        Schema::create('sd_priorities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->nullable()->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug', 64);
            $table->unsignedInteger('weight')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['desk_id', 'slug']);
        });

        Schema::create('sd_severities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->nullable()->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug', 64);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['desk_id', 'slug']);
        });

        Schema::create('sd_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->nullable()->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug', 64);
            $table->foreignId('parent_id')->nullable()->constrained('sd_categories')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['desk_id', 'slug']);
        });

        Schema::create('sd_sla_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->json('goals'); // [{priority_slug, response_minutes, resolve_minutes}]
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('sd_procedures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->constrained('sd_desks')->cascadeOnDelete();
            $table->foreignId('stage_id')->nullable()->constrained('sd_stages')->cascadeOnDelete();
            $table->string('name');
            $table->string('hook', 32); // on_create|on_stage_enter|on_escalation
            $table->boolean('is_active')->default(true);
            $table->json('steps');
            $table->timestamps();

            $table->index(['desk_id', 'hook']);
        });

        Schema::create('sd_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->constrained('sd_desks')->restrictOnDelete();
            $table->string('number', 64);
            $table->string('summary');
            $table->longText('description')->nullable();
            $table->foreignId('stage_id')->nullable()->constrained('sd_stages')->nullOnDelete();
            $table->foreignId('status_id')->nullable()->constrained('sd_statuses')->nullOnDelete();
            $table->foreignId('priority_id')->nullable()->constrained('sd_priorities')->nullOnDelete();
            $table->foreignId('severity_id')->nullable()->constrained('sd_severities')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('sd_categories')->nullOnDelete();
            $table->unsignedBigInteger('requester_user_id')->nullable()->index();
            $table->unsignedBigInteger('requester_target_id')->nullable()->index();
            $table->unsignedBigInteger('assignee_user_id')->nullable()->index();
            $table->string('assignee_pool', 120)->nullable();
            $table->unsignedInteger('escalation_level')->default(0);
            $table->timestamp('escalation_due_at')->nullable()->index();
            $table->timestamp('first_responded_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('sla_response_due_at')->nullable();
            $table->timestamp('sla_resolve_due_at')->nullable();
            $table->boolean('sla_response_breached')->default(false);
            $table->boolean('sla_resolve_breached')->default(false);
            $table->unsignedBigInteger('locked_by')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->timestamp('archived_at')->nullable()->index();
            $table->boolean('is_unread')->default(true);
            $table->json('custom_fields')->nullable();
            $table->timestamp('pending_notification_at')->nullable();
            $table->unsignedBigInteger('merged_into_id')->nullable()->index();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->unique(['desk_id', 'number']);
            $table->index(['desk_id', 'archived_at', 'stage_id']);
            $table->index(['assignee_user_id', 'archived_at']);
        });

        Schema::create('sd_ticket_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('sd_tickets')->cascadeOnDelete();
            $table->longText('body');
            $table->boolean('is_public')->default(true);
            $table->unsignedBigInteger('author_user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('sd_ticket_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('sd_tickets')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('assignee_user_id')->nullable();
            $table->decimal('hours_worked', 8, 2)->default(0);
            $table->boolean('is_completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('sd_ticket_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('sd_tickets')->cascadeOnDelete();
            $table->string('disk', 32)->default('local');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 120)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();
        });

        Schema::create('sd_ticket_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('sd_tickets')->cascadeOnDelete();
            $table->string('related_type', 32); // ticket|kb
            $table->unsignedBigInteger('related_id');
            $table->string('link_type', 32)->default('related'); // related|merged|parent|child
            $table->timestamps();

            $table->unique(['ticket_id', 'related_type', 'related_id', 'link_type'], 'sd_ticket_links_unique');
        });

        Schema::create('sd_kb_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->nullable()->constrained('sd_desks')->nullOnDelete();
            $table->string('number', 64)->nullable();
            $table->string('summary');
            $table->longText('description')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('sd_categories')->nullOnDelete();
            $table->boolean('is_published')->default(false);
            $table->unsignedBigInteger('source_ticket_id')->nullable()->index();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('locked_by')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->json('custom_fields')->nullable();
            $table->timestamps();

            $table->index(['is_published', 'summary']);
        });

        Schema::create('sd_email_readers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('desk_id')->constrained('sd_desks')->cascadeOnDelete();
            $table->string('host');
            $table->unsignedInteger('port')->default(993);
            $table->string('encryption', 16)->default('ssl');
            $table->string('username');
            $table->text('password'); // encrypted cast
            $table->string('mailbox', 120)->default('INBOX');
            $table->boolean('is_active')->default(true);
            $table->json('defaults')->nullable();
            $table->json('blacklist')->nullable();
            $table->timestamp('last_polled_at')->nullable();
            $table->unsignedInteger('fail_count')->default(0);
            $table->timestamps();
        });

        Schema::create('sd_email_inbound_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_reader_id')->nullable()->constrained('sd_email_readers')->nullOnDelete();
            $table->string('message_id')->nullable()->index();
            $table->string('from_email')->nullable();
            $table->string('subject')->nullable();
            $table->foreignId('ticket_id')->nullable()->constrained('sd_tickets')->nullOnDelete();
            $table->string('status', 32)->default('processed');
            $table->text('detail')->nullable();
            $table->timestamps();
        });

        Schema::create('sd_message_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->nullable()->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->string('subject')->nullable();
            $table->longText('body');
            $table->timestamps();
        });

        Schema::create('sd_note_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desk_id')->nullable()->constrained('sd_desks')->cascadeOnDelete();
            $table->string('name');
            $table->longText('body');
            $table->timestamps();
        });

        Schema::create('sd_user_preferences', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->unsignedInteger('email_send_delay_minutes')->default(0);
            $table->foreignId('default_desk_id')->nullable()->constrained('sd_desks')->nullOnDelete();
            $table->json('default_filters')->nullable();
            $table->string('ticket_scope', 32)->default('all'); // all|assigned|own
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sd_user_preferences');
        Schema::dropIfExists('sd_note_templates');
        Schema::dropIfExists('sd_message_templates');
        Schema::dropIfExists('sd_email_inbound_log');
        Schema::dropIfExists('sd_email_readers');
        Schema::dropIfExists('sd_kb_articles');
        Schema::dropIfExists('sd_ticket_links');
        Schema::dropIfExists('sd_ticket_attachments');
        Schema::dropIfExists('sd_ticket_tasks');
        Schema::dropIfExists('sd_ticket_notes');
        Schema::dropIfExists('sd_tickets');
        Schema::dropIfExists('sd_procedures');
        Schema::dropIfExists('sd_sla_policies');
        Schema::dropIfExists('sd_categories');
        Schema::dropIfExists('sd_severities');
        Schema::dropIfExists('sd_priorities');
        Schema::dropIfExists('sd_statuses');
        Schema::dropIfExists('sd_stages');
        Schema::dropIfExists('sd_desks');
    }
};
