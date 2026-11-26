<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Each organization gets its own login per email address.
 *
 * - Organization accounts (tenant_id set) are unique per (tenant_id, email).
 * - Platform staff accounts (tenant_id null) stay unique per email through a
 *   generated column, because MySQL allows several NULL values in a plain unique index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique('users_email_unique');
            $table->unique(['tenant_id', 'email'], 'users_tenant_email_unique');
            $table->string('platform_email')
                ->nullable()
                ->virtualAs('case when tenant_id is null then email else null end');
            $table->unique('platform_email', 'users_platform_email_unique');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique('users_platform_email_unique');
            $table->dropColumn('platform_email');
            $table->dropUnique('users_tenant_email_unique');
            $table->unique('email', 'users_email_unique');
        });
    }
};
