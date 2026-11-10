<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('targets', function (Blueprint $table) {
            $table->foreignId('department_id')
                ->nullable()
                ->after('department')
                ->constrained('departments')
                ->nullOnDelete();
        });

        $names = DB::table('targets')
            ->select('department')
            ->whereNotNull('department')
            ->where('department', '!=', '')
            ->distinct()
            ->pluck('department');

        $now = now();
        $idsByName = [];

        foreach ($names as $name) {
            $trimmed = mb_substr(trim((string) $name), 0, 120);
            if ($trimmed === '') {
                continue;
            }

            if (! array_key_exists($trimmed, $idsByName)) {
                $idsByName[$trimmed] = DB::table('departments')->insertGetId([
                    'name' => $trimmed,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('targets')
                ->where('department', $name)
                ->update([
                    'department_id' => $idsByName[$trimmed],
                    'department' => $trimmed,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('targets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('department_id');
        });
        Schema::dropIfExists('departments');
    }
};
