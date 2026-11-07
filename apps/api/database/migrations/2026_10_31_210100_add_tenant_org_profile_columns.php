<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('industry')->nullable()->after('name');
            $table->string('employee_band')->nullable()->after('industry');
            $table->string('status')->default('active')->after('employee_band');
            $table->boolean('training_enabled')->default(true)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'industry',
                'employee_band',
                'status',
                'training_enabled',
            ]);
        });
    }
};
