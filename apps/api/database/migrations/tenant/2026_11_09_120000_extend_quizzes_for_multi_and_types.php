<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table): void {
            if (! Schema::hasColumn('quizzes', 'is_required')) {
                $table->boolean('is_required')->default(true)->after('pass_score');
            }
            if (! Schema::hasColumn('quizzes', 'time_limit_seconds')) {
                $table->unsignedInteger('time_limit_seconds')->nullable()->after('is_required');
            }
            if (! Schema::hasColumn('quizzes', 'sort_order')) {
                $table->unsignedSmallInteger('sort_order')->default(0)->after('time_limit_seconds');
            }
        });

        if (! Schema::hasColumn('quiz_questions', 'type')) {
            Schema::table('quiz_questions', function (Blueprint $table): void {
                $table->string('type', 16)->default('mcq')->after('quiz_id');
            });
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE quiz_questions MODIFY options JSON NULL');
            DB::statement('ALTER TABLE quiz_questions MODIFY correct_index TINYINT UNSIGNED NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE quiz_questions ALTER COLUMN options DROP NOT NULL');
            DB::statement('ALTER TABLE quiz_questions ALTER COLUMN correct_index DROP NOT NULL');
        }

        if (! Schema::hasColumn('quiz_attempts', 'started_at')) {
            Schema::table('quiz_attempts', function (Blueprint $table): void {
                $table->timestamp('started_at')->nullable()->after('answers');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quiz_attempts', 'started_at')) {
            Schema::table('quiz_attempts', function (Blueprint $table): void {
                $table->dropColumn('started_at');
            });
        }

        if (Schema::hasColumn('quiz_questions', 'type')) {
            Schema::table('quiz_questions', function (Blueprint $table): void {
                $table->dropColumn('type');
            });
        }

        Schema::table('quizzes', function (Blueprint $table): void {
            $drop = [];
            if (Schema::hasColumn('quizzes', 'is_required')) {
                $drop[] = 'is_required';
            }
            if (Schema::hasColumn('quizzes', 'time_limit_seconds')) {
                $drop[] = 'time_limit_seconds';
            }
            if (Schema::hasColumn('quizzes', 'sort_order')) {
                $drop[] = 'sort_order';
            }
            if ($drop !== []) {
                $table->dropColumn($drop);
            }
        });
    }
};
