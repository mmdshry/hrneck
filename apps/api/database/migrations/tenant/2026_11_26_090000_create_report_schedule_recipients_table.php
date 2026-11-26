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
        Schema::create('report_schedule_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_schedule_id')->constrained('report_schedules')->cascadeOnDelete();
            // Users live on the central connection, so user_id cannot be a foreign key.
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
            $table->unique(['report_schedule_id', 'user_id']);
            $table->index('user_id');
        });

        // Carry each address over when it belongs to an active member of this organization.
        // Other schedules end up without recipients and stay idle until an admin picks people again.
        $tenantId = tenant('id');
        if (is_string($tenantId) && $tenantId !== '') {
            $userIdsByEmail = User::query()
                ->inTenant($tenantId)
                ->whereNull('disabled_at')
                ->get(['id', 'email'])
                ->mapWithKeys(fn (User $user): array => [strtolower(trim((string) $user->email)) => (int) $user->id]);

            DB::table('report_schedules')
                ->select(['id', 'recipient_email'])
                ->orderBy('id')
                ->chunkById(200, function ($rows) use ($userIdsByEmail): void {
                    $now = now();
                    $links = [];
                    foreach ($rows as $row) {
                        $userId = $userIdsByEmail[strtolower(trim((string) $row->recipient_email))] ?? null;
                        if ($userId !== null) {
                            $links[] = [
                                'report_schedule_id' => $row->id,
                                'user_id' => $userId,
                                'created_at' => $now,
                                'updated_at' => $now,
                            ];
                        }
                    }

                    if ($links !== []) {
                        DB::table('report_schedule_recipients')->insert($links);
                    }
                });
        }

        Schema::table('report_schedules', function (Blueprint $table) {
            $table->dropColumn('recipient_email');
        });
    }

    public function down(): void
    {
        Schema::table('report_schedules', function (Blueprint $table) {
            $table->string('recipient_email')->nullable();
        });

        // Restore the first recipient's address so a rollback keeps one address per schedule.
        $links = DB::table('report_schedule_recipients')->orderBy('id')->get(['report_schedule_id', 'user_id']);
        $emailsByUserId = User::query()
            ->whereIn('id', $links->pluck('user_id')->unique()->values()->all())
            ->pluck('email', 'id');

        $firstEmailBySchedule = [];
        foreach ($links as $link) {
            $firstEmailBySchedule[$link->report_schedule_id] ??= $emailsByUserId[$link->user_id] ?? null;
        }

        foreach ($firstEmailBySchedule as $scheduleId => $email) {
            DB::table('report_schedules')->where('id', $scheduleId)->update(['recipient_email' => (string) $email]);
        }

        DB::table('report_schedules')->whereNull('recipient_email')->update(['recipient_email' => '']);

        Schema::dropIfExists('report_schedule_recipients');
    }
};
