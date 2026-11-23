<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // No FK: departments live in tenant DBs.
            $table->unsignedBigInteger('department_id')->nullable()->after('tenant_id');
            $table->string('department')->nullable()->after('department_id');
            $table->index('department_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['department_id']);
            $table->dropColumn(['department_id', 'department']);
        });
    }
};
