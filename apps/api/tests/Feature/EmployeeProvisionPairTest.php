<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Jobs\SendEmployeeInviteJob;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Resources\Targets\TargetResource;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Spatie\Activitylog\Models\Activity;
use Stancl\Tenancy\Facades\Tenancy;

test('creating a target provisions a learner user and queues invite', function () {
    Queue::fake();

    $admin = orgAdmin();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'New.Hire@Example.TEST',
            'first_name' => 'New',
            'last_name' => 'Hire',
        ])
        ->assertCreated()
        ->assertJsonPath('meta.login_invited', true);

    $user = User::query()->whereRaw('LOWER(email) = ?', ['new.hire@example.test'])->first();
    expect($user)->not->toBeNull();
    expect($user->tenant_id)->toBe('itneck');
    expect($user->must_set_password)->toBeTrue();

    setPermissionsTeamId('itneck');
    expect($user->hasRole(OrgPermissionCatalog::LEARNER))->toBeTrue();
    expect($user->can(OrgPermissionCatalog::TICKETING_PORTAL))->toBeTrue();
    setPermissionsTeamId(null);

    Queue::assertPushed(SendEmployeeInviteJob::class);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->where('email', 'new.hire@example.test')->first();
    expect($target)->not->toBeNull();
    expect($target->user_id)->toBe($user->id);
    expect($target->joined_via)->toBe('manual');
    Tenancy::end();
});

test('creating a learner org user creates a matching target', function () {
    $user = app(CreateOrgUser::class)->handle(
        'itneck',
        'Learner Only',
        'learner.only@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    expect($user->must_set_password)->toBeFalse();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->whereRaw('LOWER(email) = ?', ['learner.only@itneck.test'])->first();
    expect($target)->not->toBeNull();
    expect($target->status)->toBe('active');
    Tenancy::end();
});

test('creating an org admin also creates its linked employee target', function () {
    $user = app(CreateOrgUser::class)->handle(
        'itneck',
        'Ops Only',
        'ops.only@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::ORG_ADMIN],
    );

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->whereRaw('LOWER(email) = ?', ['ops.only@itneck.test'])->first();
    expect($target)->not->toBeNull()
        ->and($target->user_id)->toBe($user->id)
        ->and($target->joined_via)->toBe('account');
    Tenancy::end();
});

test('inactive target blocks learn assignments', function () {
    Queue::fake();
    $admin = orgAdmin();

    $create = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'inactive.learn@itneck.test',
            'first_name' => 'In',
            'last_name' => 'Active',
        ])
        ->assertCreated();

    $targetId = (int) $create->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/targets/'.$targetId, ['status' => 'inactive'])
        ->assertOk();

    $learner = User::query()->where('email', 'inactive.learn@itneck.test')->firstOrFail();
    $learner->forceFill([
        'must_set_password' => false,
        'password' => 'DemoPass!234',
    ])->save();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/training/assignments')
        ->assertStatus(422);
});

test('must_set_password blocks login until invite reset', function () {
    $learner = User::factory()->create([
        'name' => 'Invite Block',
        'email' => 'invite.block@itneck.test',
        'password' => 'DemoPass!234',
        'tenant_id' => 'itneck',
        'must_set_password' => true,
    ]);

    expect($learner->fresh()->must_set_password)->toBeTrue();

    $this->postJson('/api/v1/auth/login', tenantLoginBody('itneck', 'invite.block@itneck.test', 'DemoPass!234'))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('deleting an employee hides the paired login without removing an operator', function () {
    Queue::fake();
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'gone.employee@itneck.test',
            'first_name' => 'Gone',
            'last_name' => 'Employee',
        ])
        ->assertCreated();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/targets/'.$created->json('data.id'))
        ->assertOk();

    $listed = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/users?q=gone.employee@itneck.test')
        ->assertOk()
        ->json('data');

    expect(collect($listed)->pluck('email'))->not->toContain('gone.employee@itneck.test');

    $user = User::query()->where('email', 'gone.employee@itneck.test')->first();
    expect($user)->not->toBeNull()
        ->and($user->disabled_at)->not->toBeNull();
});

test('deleting a learner user removes the paired employee', function () {
    $user = app(CreateOrgUser::class)->handle(
        'itneck',
        'Learner Drop',
        'learner.drop@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/users/'.$user->id)
        ->assertOk();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Target::query()->where('email', 'learner.drop@itneck.test')->exists())->toBeFalse();
    Tenancy::end();
});

test('employee department is copied onto the paired user', function () {
    Queue::fake();
    $admin = orgAdmin();

    $dept = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/departments', ['name' => 'Audit Desk'])
        ->assertCreated();
    $deptId = (int) $dept->json('data.id');

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'desk.person@itneck.test',
            'first_name' => 'Desk',
            'last_name' => 'Person',
            'department_id' => $deptId,
        ])
        ->assertCreated();

    $user = User::query()->where('email', 'desk.person@itneck.test')->first();
    expect($user)->not->toBeNull()
        ->and($user->department_id)->toBe($deptId)
        ->and($user->department)->toBe('Audit Desk');

    $next = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/departments', ['name' => 'Audit Floor'])
        ->assertCreated();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/targets/'.$created->json('data.id'), [
            'department_id' => (int) $next->json('data.id'),
        ])
        ->assertOk();

    expect($user->fresh()->department)->toBe('Audit Floor');
});

test('filament employee resource uses employee labels', function () {
    expect(TargetResource::getModelLabel())->toBe('Employee')
        ->and(TargetResource::getPluralModelLabel())->toBe('Employees');
});

test('creating an employee with a password makes the login usable immediately without an invite', function () {
    Queue::fake();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'pw.created@itneck.test',
            'first_name' => 'Pw',
            'last_name' => 'Created',
            'password' => 'EmployeePass!234',
        ])
        ->assertCreated()
        ->assertJsonPath('meta.login_invited', false);

    Queue::assertNotPushed(SendEmployeeInviteJob::class);

    $user = User::query()->where('email', 'pw.created@itneck.test')->firstOrFail();
    expect($user->must_set_password)->toBeFalse();

    $this->postJson('/api/v1/auth/login', tenantLoginBody('itneck', 'pw.created@itneck.test', 'EmployeePass!234'))
        ->assertOk();
});

test('creating an employee with a password is rejected when a login already exists for the email', function () {
    Queue::fake();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'admin@itneck.test',
            'first_name' => 'Dup',
            'last_name' => 'Login',
            'password' => 'EmployeePass!234',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email']);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Target::query()->where('email', 'admin@itneck.test')->exists())->toBeFalse();
    Tenancy::end();
});

test('admin sets an employee password from the list and the login clears the invite state', function () {
    Queue::fake();
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'set.pw@itneck.test',
            'first_name' => 'Set',
            'last_name' => 'Pw',
        ])
        ->assertCreated();

    $user = User::query()->where('email', 'set.pw@itneck.test')->firstOrFail();
    expect($user->must_set_password)->toBeTrue();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets/'.$created->json('data.id').'/password', [
            'password' => 'NewEmployee!234',
            'password_confirmation' => 'NewEmployee!234',
        ])
        ->assertOk();

    $user->refresh();
    expect($user->must_set_password)->toBeFalse()
        ->and(Hash::check('NewEmployee!234', $user->getAuthPassword()))->toBeTrue();

    $this->postJson('/api/v1/auth/login', tenantLoginBody('itneck', 'set.pw@itneck.test', 'NewEmployee!234'))
        ->assertOk();

    $activity = Activity::query()->inLog('targets')->where('event', 'password_set')->latest('id')->first();
    expect($activity)->not->toBeNull()
        ->and(json_encode($activity->properties))->not->toContain('NewEmployee!234');
});

test('setting an employee password requires the targets permission', function () {
    app(CreateOrgUser::class)->handle(
        'itneck',
        'Pw Learner',
        'pw.learner@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $targetId = Target::query()->where('email', 'pw.learner@itneck.test')->value('id');
    Tenancy::end();

    $this->actingAs(User::query()->where('email', 'pw.learner@itneck.test')->firstOrFail())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets/'.$targetId.'/password', [
            'password' => 'NewEmployee!234',
            'password_confirmation' => 'NewEmployee!234',
        ])
        ->assertForbidden();
});

test('setting an employee password only changes the login of that organization', function () {
    app(CreateOrgUser::class)->handle(
        'company',
        'Other Org',
        'other.org@company.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $targetId = Target::query()->create([
        'email' => 'other.org@company.test',
        'first_name' => 'Other',
        'last_name' => 'Org',
        'status' => 'active',
        'joined_via' => 'manual',
    ])->id;
    Tenancy::end();

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets/'.$targetId.'/password', [
            'password' => 'NewEmployee!234',
            'password_confirmation' => 'NewEmployee!234',
        ])
        ->assertOk();

    $companyLogin = User::query()->withEmail('other.org@company.test')->where('tenant_id', 'company')->firstOrFail();
    $itneckLogin = User::query()->withEmail('other.org@company.test')->where('tenant_id', 'itneck')->firstOrFail();

    expect($itneckLogin->id)->not->toBe($companyLogin->id);
    expect(Hash::check('DemoPass!234', $companyLogin->getAuthPassword()))->toBeTrue();
    expect(Hash::check('NewEmployee!234', $itneckLogin->getAuthPassword()))->toBeTrue();
});
