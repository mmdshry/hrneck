<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\DemoSeeder::class);
});

test('org admin can update archive and delete targets and groups with audit', function () {
    $admin = orgAdmin();

    $create = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'audit.target@itneck.test',
            'first_name' => 'Audit',
            'last_name' => 'Target',
        ])
        ->assertCreated();

    $targetId = (int) $create->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/targets/'.$targetId, [
            'department' => 'Security',
            'status' => 'inactive',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'inactive');

    $group = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/groups', [
            'name' => 'Audit Group',
            'target_ids' => [$targetId],
        ])
        ->assertCreated();

    $groupId = (int) $group->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/groups/'.$groupId, [
            'name' => 'Audit Group Renamed',
            'target_ids' => [],
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Audit Group Renamed');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/groups/'.$groupId)
        ->assertOk();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/targets/'.$targetId)
        ->assertOk();

    Tenancy::initialize('itneck');
    expect(Activity::query()->inLog('targets')->where('event', 'archived')->count())->toBeGreaterThan(0);
    expect(Activity::query()->inLog('targets')->where('event', 'deleted')->count())->toBeGreaterThan(0);
    expect(Activity::query()->inLog('groups')->where('event', 'deleted')->count())->toBeGreaterThan(0);
    expect(Target::query()->find($targetId))->toBeNull();
    Tenancy::end();
});

test('org admin can cancel campaigns and mutate sending profiles', function () {
    $admin = orgAdmin();

    $campaign = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Draft Campaign',
            'target_ids' => [],
            'group_ids' => [],
            'launch' => false,
        ]);

    // Campaign may require audience — create a target first if needed.
    if ($campaign->status() === 422) {
        $target = $this->actingAs($admin)
            ->withHeader('X-Tenant', 'itneck')
            ->postJson('/api/v1/org/targets', [
                'email' => 'campaign.audience@itneck.test',
            ])
            ->assertCreated();

        $campaign = $this->actingAs($admin)
            ->withHeader('X-Tenant', 'itneck')
            ->postJson('/api/v1/org/campaigns', [
                'name' => 'Draft Campaign',
                'target_ids' => [(int) $target->json('data.id')],
                'launch' => false,
            ])
            ->assertCreated();
    } else {
        $campaign->assertCreated();
    }

    $campaignId = (int) $campaign->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/campaigns/'.$campaignId, [
            'status' => 'cancelled',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    $profile = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/sending-profiles', [
            'name' => 'Audit SMTP',
            'from_name' => 'Audit',
            'from_email' => 'audit@hrneck.test',
        ])
        ->assertCreated();

    $profileId = (int) $profile->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/sending-profiles/'.$profileId, [
            'name' => 'Audit SMTP Updated',
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Audit SMTP Updated');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/sending-profiles/'.$profileId)
        ->assertOk();

    Tenancy::initialize('itneck');
    expect(Activity::query()->inLog('campaigns')->where('event', 'cancelled')->count())->toBeGreaterThan(0);
    expect(Activity::query()->inLog('settings')->where('event', 'sending_profile_deleted')->count())->toBeGreaterThan(0);
    Tenancy::end();
});

test('org admin can patch users announcements schedules and archives routes exist', function () {
    $admin = orgAdmin();

    $user = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Patchable',
            'email' => 'patchable@itneck.test',
            'password' => 'DemoPass!234',
            'roles' => ['org_admin'],
        ])
        ->assertCreated();

    $userId = (int) $user->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/users/'.$userId, [
            'name' => 'Patched Name',
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Patched Name');

    $announcement = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/announcements', [
            'title' => 'To retract',
            'body' => 'Body',
        ])
        ->assertCreated();

    $announcementId = (int) $announcement->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/announcements/'.$announcementId, [
            'title' => 'Retracted title',
        ])
        ->assertOk();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/announcements/'.$announcementId)
        ->assertOk();

    $schedule = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/reports/schedules', [
            'name' => 'Weekly',
            'cadence' => 'weekly',
            'format' => 'csv',
            'recipient_email' => 'leaders@itneck.test',
        ])
        ->assertCreated();

    $scheduleId = (int) $schedule->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/reports/schedules/'.$scheduleId, [
            'name' => 'Weekly Updated',
        ])
        ->assertOk();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/reports/schedules/'.$scheduleId)
        ->assertOk();
});

test('user without manage permission cannot mutate targets', function () {
    $viewer = app(CreateOrgUser::class)->handle(
        'itneck',
        'Reports Viewer',
        'crud-viewer@itneck.test',
        'DemoPass!234',
        [],
    );

    setPermissionsTeamId('itneck');
    $role = Role::create([
        'name' => 'reports_only_crud',
        'guard_name' => OrgPermissionCatalog::GUARD,
        config('permission.column_names.team_foreign_key') => 'itneck',
    ]);
    $role->syncPermissions([OrgPermissionCatalog::REPORTS_VIEW]);
    $viewer->syncRoles([$role]);
    setPermissionsTeamId(null);

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'forbidden@itneck.test',
        ])
        ->assertForbidden();
});

test('org user cannot access filament panel while platform staff can', function () {
    expect(orgAdmin()->canAccessPanel(Filament\Facades\Filament::getPanel('admin')))->toBeFalse();
    expect(platformAdmin()->canAccessPanel(Filament\Facades\Filament::getPanel('admin')))->toBeTrue();
});
