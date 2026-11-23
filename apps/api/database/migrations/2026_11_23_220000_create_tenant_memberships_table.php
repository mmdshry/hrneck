<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_memberships', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('tenant_id');
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('department')->nullable();
            $table->timestamp('disabled_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'tenant_id']);
            $table->index('tenant_id');
            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->cascadeOnDelete();
        });

        $users = DB::table('users')
            ->whereNotNull('tenant_id')
            ->select(['id', 'tenant_id', 'department_id', 'department', 'created_at', 'updated_at'])
            ->get();

        $now = now();
        foreach ($users as $user) {
            DB::table('tenant_memberships')->insert([
                'user_id' => $user->id,
                'tenant_id' => $user->tenant_id,
                'department_id' => $user->department_id,
                'department' => $user->department,
                'disabled_at' => null,
                'created_at' => $user->created_at ?? $now,
                'updated_at' => $user->updated_at ?? $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_memberships');
    }
};
