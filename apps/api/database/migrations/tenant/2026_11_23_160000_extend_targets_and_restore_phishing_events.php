<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('targets', function (Blueprint $table) {
            $table->string('job_title')->nullable()->after('department_id');
            $table->foreignId('manager_target_id')
                ->nullable()
                ->after('job_title')
                ->constrained('targets')
                ->nullOnDelete();
            $table->date('hire_date')->nullable()->after('manager_target_id');
            $table->string('employee_number')->nullable()->after('hire_date');
            $table->string('phone')->nullable()->after('employee_number');
            $table->string('location')->nullable()->after('phone');
            $table->string('employment_type')->nullable()->after('location');
            $table->unsignedBigInteger('user_id')->nullable()->index()->after('employment_type');
            $table->string('preferred_language', 16)->nullable()->after('user_id');
            $table->string('timezone', 64)->nullable()->after('preferred_language');
            $table->string('risk_tier')->default('unknown')->after('risk_score');
            $table->timestamp('risk_updated_at')->nullable()->after('risk_tier');
            $table->string('risk_source')->nullable()->after('risk_updated_at');
            $table->timestamp('last_training_completed_at')->nullable()->after('risk_source');
            $table->boolean('notification_opt_out')->default(false)->after('last_training_completed_at');
            $table->string('joined_via')->nullable()->after('notification_opt_out');

            $table->unique('employee_number');
            $table->index('job_title');
            $table->index('employment_type');
            $table->index('risk_tier');
            $table->index('location');
        });

        Schema::table('campaign_recipients', function (Blueprint $table) {
            $table->string('tracking_token', 64)->nullable()->after('target_id');
            $table->timestamp('clicked_at')->nullable()->after('opened_at');
            $table->timestamp('submitted_at')->nullable()->after('clicked_at');
            $table->timestamp('reported_at')->nullable()->after('submitted_at');
        });

        // Unique index only when token is present (MySQL allows multiple NULLs).
        Schema::table('campaign_recipients', function (Blueprint $table) {
            $table->unique('tracking_token');
        });

        $tenantId = tenant('id');
        if (is_string($tenantId) && $tenantId !== '') {
            $usersByEmail = User::query()
                ->where('tenant_id', $tenantId)
                ->get(['id', 'email'])
                ->mapWithKeys(function (User $user): array {
                    return [strtolower(trim((string) $user->email)) => $user->id];
                });

            DB::table('targets')
                ->select(['id', 'email', 'user_id'])
                ->orderBy('id')
                ->chunkById(200, function ($rows) use ($usersByEmail): void {
                    foreach ($rows as $row) {
                        if ($row->user_id !== null) {
                            continue;
                        }
                        $email = strtolower(trim((string) $row->email));
                        $userId = $usersByEmail[$email] ?? null;
                        if ($userId === null) {
                            continue;
                        }
                        DB::table('targets')->where('id', $row->id)->update(['user_id' => $userId]);
                    }
                });
        }
    }

    public function down(): void
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

        Schema::table('targets', function (Blueprint $table) {
            $table->dropUnique(['employee_number']);
            $table->dropIndex(['job_title']);
            $table->dropIndex(['employment_type']);
            $table->dropIndex(['risk_tier']);
            $table->dropIndex(['location']);
            $table->dropConstrainedForeignId('manager_target_id');
            $table->dropColumn([
                'job_title',
                'hire_date',
                'employee_number',
                'phone',
                'location',
                'employment_type',
                'user_id',
                'preferred_language',
                'timezone',
                'risk_tier',
                'risk_updated_at',
                'risk_source',
                'last_training_completed_at',
                'notification_opt_out',
                'joined_via',
            ]);
        });
    }
};
