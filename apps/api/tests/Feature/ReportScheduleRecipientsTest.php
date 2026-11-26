<?php

use App\Domains\AnalyticsReporting\Actions\DispatchDueReportSchedules;
use App\Domains\AnalyticsReporting\Mails\CampaignReportMail;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Stancl\Tenancy\Facades\Tenancy;

beforeEach(function () {
    Mail::fake();
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
});

/**
 * Creates an itneck member whose only access comes from one custom role.
 *
 * @param  list<string>  $permissions
 */
function reportRecipientMember(string $email, string $roleName, array $permissions): User
{
    $user = app(CreateOrgUser::class)->handle('itneck', $roleName.' member', $email, 'DemoPass!234', []);

    setPermissionsTeamId('itneck');
    $role = Role::create([
        'name' => $roleName,
        'guard_name' => OrgPermissionCatalog::GUARD,
        config('permission.column_names.team_foreign_key') => 'itneck',
    ]);
    $role->syncPermissions($permissions);
    $user->syncRoles([$role]);
    setPermissionsTeamId(null);

    return $user;
}

test('the recipient list offers only members with report access', function () {
    $reader = reportRecipientMember('recipients.reader@itneck.test', 'recipient_reader', [
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);
    $plain = reportRecipientMember('recipients.plain@itneck.test', 'recipient_plain', [
        OrgPermissionCatalog::USERS_VIEW,
    ]);

    $emails = collect($this->actingAs($reader)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/recipients')
        ->assertOk()
        ->json('data'))
        ->pluck('email')
        ->all();

    expect($emails)->toContain('admin@itneck.test')
        ->toContain('recipients.reader@itneck.test')
        ->not->toContain('recipients.plain@itneck.test');

    $this->actingAs($plain)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/recipients')
        ->assertForbidden();
});

test('schedules only accept recipients with report access', function () {
    $plain = reportRecipientMember('schedule.plain@itneck.test', 'schedule_plain', [
        OrgPermissionCatalog::USERS_VIEW,
    ]);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Leaks users',
            'cadence' => 'monthly',
            'format' => 'csv',
            'recipient_user_ids' => [$plain->id],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['recipient_user_ids']);

    expect(ReportSchedule::query()->count())->toBe(0);
});

test('schedules reject users who are not members of the organization', function () {
    $outsider = User::factory()->create();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Outsider',
            'cadence' => 'monthly',
            'format' => 'csv',
            'recipient_user_ids' => [$outsider->id],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['recipient_user_ids']);
});

test('a schedule keeps every chosen recipient and flags people who lost report access', function () {
    $admin = orgAdmin();
    $viewer = reportRecipientMember('schedule.viewer@itneck.test', 'schedule_viewer', [
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Both',
            'cadence' => 'monthly',
            'format' => 'csv',
            'recipient_user_ids' => [$admin->id, $viewer->id],
        ])
        ->assertCreated()
        ->assertJsonCount(2, 'data.recipients');

    setPermissionsTeamId('itneck');
    $viewer->syncRoles([]);
    setPermissionsTeamId(null);

    $recipients = collect($this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/reports/schedules')
        ->assertOk()
        ->json('data.0.recipients'))
        ->keyBy('email');

    expect($recipients['admin@itneck.test']['eligible'])->toBeTrue()
        ->and($recipients['schedule.viewer@itneck.test']['eligible'])->toBeFalse();
});

test('updating a schedule replaces its recipients', function () {
    $admin = orgAdmin();
    $viewer = reportRecipientMember('update.viewer@itneck.test', 'update_viewer', [
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);

    $scheduleId = (int) $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Admin only',
            'cadence' => 'monthly',
            'format' => 'csv',
            'recipient_user_ids' => [$admin->id],
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/reports/schedules/'.$scheduleId, [
            'recipient_user_ids' => [$viewer->id],
        ])
        ->assertOk();

    expect(ReportSchedule::query()->findOrFail($scheduleId)->recipientUserIds())
        ->toBe([(int) $viewer->id]);
});

test('dispatch sends only to recipients who still have report access', function () {
    $admin = orgAdmin();
    $viewer = reportRecipientMember('dispatch.viewer@itneck.test', 'dispatch_viewer', [
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);

    $schedule = ReportSchedule::query()->create([
        'name' => 'Monthly CSV',
        'cadence' => 'monthly',
        'format' => 'csv',
        'next_run_at' => now()->subMinute(),
    ]);
    $schedule->syncRecipientUserIds([$admin->id, $viewer->id]);

    setPermissionsTeamId('itneck');
    $viewer->syncRoles([]);
    setPermissionsTeamId(null);

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, 1);
    Mail::assertSent(CampaignReportMail::class, fn (CampaignReportMail $mail): bool => $mail->hasTo('admin@itneck.test'));
    Mail::assertNotSent(CampaignReportMail::class, fn (CampaignReportMail $mail): bool => $mail->hasTo('dispatch.viewer@itneck.test'));
});

test('dispatch skips recipients whose account was disabled', function () {
    $admin = orgAdmin();
    $disabled = reportRecipientMember('dispatch.disabled@itneck.test', 'dispatch_disabled', [
        OrgPermissionCatalog::REPORTS_VIEW,
    ]);

    $schedule = ReportSchedule::query()->create([
        'name' => 'Monthly CSV',
        'cadence' => 'monthly',
        'format' => 'csv',
        'next_run_at' => now()->subMinute(),
    ]);
    $schedule->syncRecipientUserIds([$admin->id, $disabled->id]);

    $disabled->forceFill(['disabled_at' => now()])->save();

    app(DispatchDueReportSchedules::class)->handle();

    Mail::assertSent(CampaignReportMail::class, 1);
    Mail::assertSent(CampaignReportMail::class, fn (CampaignReportMail $mail): bool => $mail->hasTo('admin@itneck.test'));
});
