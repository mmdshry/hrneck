<?php

use App\Domains\TargetsGroups\Models\Department;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Models\TargetImportMapping;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('csv import upserts targets in tenant', function () {
    $user = orgAdmin();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);

    $csv = "email,first_name,last_name,department\ncsv.user@example.test,Csv,User,IT\n";
    $file = UploadedFile::fake()->createWithContent('targets.csv', $csv);

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/import', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('imported', 1)
        ->assertJsonPath('created', 1);

    $target = Target::query()->where('email', 'csv.user@example.test')->first();
    expect($target)->not->toBeNull();
    expect($target->department)->toBe('IT');
    expect($target->department_id)->not->toBeNull();
    expect(Department::query()->where('name', 'IT')->exists())->toBeTrue();
    expect(Department::query()->where('name', 'IT')->value('id'))->toBe($target->department_id);

    Tenancy::end();
});

test('legacy csv import accepts aliased headers', function () {
    $user = orgAdmin();

    $csv = "Email Address,First Name,Last Name,Dept\nalias.user@example.test,Alias,User,Security\n";
    $file = UploadedFile::fake()->createWithContent('targets.csv', $csv);

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/import', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('imported', 1);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->where('email', 'alias.user@example.test')->first();
    expect($target)->not->toBeNull();
    expect($target->first_name)->toBe('Alias');
    expect($target->department)->toBe('Security');
    Tenancy::end();
});

test('import session preview and commit with column map', function () {
    $user = orgAdmin();

    $csv = implode("\n", [
        'Email Address,Given Name,Family Name,Dept,Emp ID',
        'map.one@example.test,One,Person,Ops,E-MAP-1',
        'bad-email,Two,Person,Ops,E-MAP-2',
        'map.one@example.test,Dup,Person,Ops,E-MAP-3',
        '',
    ]);
    $file = UploadedFile::fake()->createWithContent('hr.csv', $csv);

    $sessionResponse = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/import/sessions', ['file' => $file])
        ->assertCreated()
        ->assertJsonPath('data.row_count', 3)
        ->assertJsonPath('data.suggested_map.email', 'Email Address')
        ->assertJsonPath('data.suggested_map.first_name', 'Given Name');

    $sessionId = $sessionResponse->json('data.id');
    $columnMap = [
        'email' => 'Email Address',
        'first_name' => 'Given Name',
        'last_name' => 'Family Name',
        'department' => 'Dept',
        'employee_number' => 'Emp ID',
    ];

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/targets/import/sessions/{$sessionId}/preview", [
            'column_map' => $columnMap,
        ])
        ->assertOk()
        ->assertJsonPath('data.would_create', 1)
        ->assertJsonPath('data.skipped', 2);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Target::query()->where('email', 'map.one@example.test')->exists())->toBeFalse();
    Tenancy::end();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/targets/import/sessions/{$sessionId}/commit", [
            'column_map' => $columnMap,
            'save_mapping' => ['name' => 'HR export map'],
        ])
        ->assertOk()
        ->assertJsonPath('created', 1)
        ->assertJsonPath('skipped', 2)
        ->assertJsonPath('imported', 1);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->where('email', 'map.one@example.test')->first();
    expect($target)->not->toBeNull();
    expect($target->employee_number)->toBe('E-MAP-1');
    expect($target->joined_via)->toBe('csv');
    expect(TargetImportMapping::query()->where('name', 'HR export map')->exists())->toBeTrue();
    Tenancy::end();
});

test('import mapping crud', function () {
    $user = orgAdmin();

    $create = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets/import/mappings', [
            'name' => 'Workday',
            'column_map' => [
                'email' => 'Work Email',
                'first_name' => 'Legal First Name',
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Workday');

    $id = (int) $create->json('data.id');

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/targets/import/mappings')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Workday');

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson("/api/v1/org/targets/import/mappings/{$id}", [
            'name' => 'Workday v2',
            'column_map' => [
                'email' => 'Work Email',
                'last_name' => 'Legal Last Name',
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Workday v2');

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson("/api/v1/org/targets/import/mappings/{$id}")
        ->assertOk();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(TargetImportMapping::query()->whereKey($id)->exists())->toBeFalse();
    Tenancy::end();
});

test('import session preview is forbidden for another org admin', function () {
    $owner = orgAdmin();
    $other = app(\App\Domains\IdentityAccess\Actions\CreateOrgUser::class)->handle(
        'itneck',
        'Other Admin',
        'other.admin@itneck.test',
        'DemoPass!234',
        ['org_admin'],
    );

    $csv = "email,first_name\nsession.owner@example.test,Owner\n";
    $file = UploadedFile::fake()->createWithContent('owned.csv', $csv);

    $sessionId = $this->actingAs($owner)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/import/sessions', ['file' => $file])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($other)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/targets/import/sessions/{$sessionId}/preview", [
            'column_map' => [
                'email' => 'email',
                'first_name' => 'first_name',
            ],
        ])
        ->assertForbidden();
});

test('preview reports duplicate employee_number without writing', function () {
    $user = orgAdmin();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    Target::query()->create([
        'email' => 'owner@example.test',
        'employee_number' => 'E-DUP',
        'status' => 'active',
    ]);
    Tenancy::end();

    $csv = "email,employee_number\nthief@example.test,E-DUP\n";
    $file = UploadedFile::fake()->createWithContent('dup.csv', $csv);

    $sessionId = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/import/sessions', ['file' => $file])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/targets/import/sessions/{$sessionId}/preview", [
            'column_map' => [
                'email' => 'email',
                'employee_number' => 'employee_number',
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.would_create', 0)
        ->assertJsonPath('data.skipped', 1);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Target::query()->where('email', 'thief@example.test')->exists())->toBeFalse();
    Tenancy::end();
});
