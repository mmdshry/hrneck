<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every organization account is an employee. Creates the employee Target for each active member of
 * this tenant that has none. An existing Target with the same email is linked instead of duplicated.
 *
 * Runs once per tenant database. Accounts and memberships live on the central connection, so they are
 * read there. Values are literal on purpose so later changes to application classes cannot alter this.
 */
return new class extends Migration
{
    private const JOINED_VIA = 'account';

    public function up(): void
    {
        $tenantId = tenant('id');
        if (! is_string($tenantId) || $tenantId === '' || ! Schema::hasTable('targets')) {
            return;
        }

        $members = DB::connection(config('tenancy.database.central_connection'))
            ->table('tenant_memberships as m')
            ->join('users as u', 'u.id', '=', 'm.user_id')
            ->where('m.tenant_id', $tenantId)
            ->whereNull('m.disabled_at')
            ->whereNull('u.disabled_at')
            ->orderBy('u.id')
            ->get(['u.id', 'u.name', 'u.email', 'm.department_id', 'm.department']);

        if ($members->isEmpty()) {
            return;
        }

        $departmentIds = DB::table('departments')->pluck('id')->flip();
        $now = now();

        foreach ($members as $member) {
            $email = strtolower(trim((string) $member->email));
            if ($email === '' || DB::table('targets')->where('user_id', $member->id)->exists()) {
                continue;
            }

            $sameEmail = DB::table('targets')->whereRaw('LOWER(email) = ?', [$email])->first(['id', 'user_id']);
            if ($sameEmail !== null) {
                if ($sameEmail->user_id === null) {
                    DB::table('targets')->where('id', $sameEmail->id)->update(['user_id' => $member->id]);
                }

                continue;
            }

            $nameParts = preg_split('/\s+/', trim((string) $member->name), 2) ?: [];
            $departmentId = $member->department_id !== null && $departmentIds->has((int) $member->department_id)
                ? (int) $member->department_id
                : null;

            DB::table('targets')->insert([
                'email' => $email,
                'first_name' => ($nameParts[0] ?? '') !== '' ? $nameParts[0] : null,
                'last_name' => ($nameParts[1] ?? '') !== '' ? $nameParts[1] : null,
                'department_id' => $departmentId,
                'department' => $member->department,
                'status' => 'active',
                'user_id' => $member->id,
                'joined_via' => self::JOINED_VIA,
                'risk_score' => 0,
                'risk_tier' => 'unknown',
                'notification_opt_out' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Data backfill; the created employee rows are left in place.
    }
};
