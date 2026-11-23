<?php

use App\Domains\TargetsGroups\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('org admin can assign and clear user department_id', function () {
    $admin = orgAdmin();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $department = Department::query()->create([
        'name' => 'Executive',
        'is_active' => true,
    ]);
    $departmentId = $department->id;
    Tenancy::end();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Dept User',
            'email' => 'dept.user@itneck.test',
            'password' => 'DemoPass!234',
            'roles' => ['kb_admin'],
            'department_id' => $departmentId,
        ])
        ->assertCreated()
        ->assertJsonPath('data.department_id', $departmentId)
        ->assertJsonPath('data.department', 'Executive');

    $userId = (int) $created->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/users/'.$userId, [
            'department_id' => null,
        ])
        ->assertOk()
        ->assertJsonPath('data.department_id', null)
        ->assertJsonPath('data.department', null);

    $user = User::query()->findOrFail($userId);
    expect($user->department_id)->toBeNull();
    expect($user->department)->toBeNull();
});

test('renaming a department syncs denormalized name on users', function () {
    $admin = orgAdmin();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $department = Department::query()->create([
        'name' => 'Ops',
        'is_active' => true,
    ]);
    $departmentId = $department->id;
    Tenancy::end();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Rename Sync',
            'email' => 'rename.sync@itneck.test',
            'password' => 'DemoPass!234',
            'roles' => ['org_admin'],
            'department_id' => $departmentId,
        ])
        ->assertCreated();

    $userId = (int) $created->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/departments/'.$departmentId, [
            'name' => 'Operations',
        ])
        ->assertOk();

    $user = User::query()->findOrFail($userId);
    expect($user->department)->toBe('Operations');
});
