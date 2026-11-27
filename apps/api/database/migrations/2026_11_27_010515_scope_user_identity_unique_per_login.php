<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * One Google or Microsoft account can link to one login per organization, so the subject is unique per login.
 * Rolling back fails while any subject is linked to more than one login.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_identities', function (Blueprint $table): void {
            $table->dropUnique(['provider', 'subject']);
            $table->unique(['provider', 'subject', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('user_identities', function (Blueprint $table): void {
            $table->dropUnique(['provider', 'subject', 'user_id']);
            $table->unique(['provider', 'subject']);
        });
    }
};
