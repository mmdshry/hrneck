<?php

use App\Domains\Checklists\Models\ChecklistAnswer;
use App\Domains\Checklists\Models\ChecklistPack;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\Models\Activity;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
    $this->user = orgAdmin();
    $this->tenant = Tenant::query()->findOrFail('itneck');
});

function asChecklistAdmin($test): mixed
{
    return $test->actingAs($test->user)->withHeader('X-Tenant', 'itneck');
}

test('system hr templates are seeded', function () {
    Tenancy::initialize($this->tenant);
    expect(ChecklistTemplate::query()->where('is_system', true)->count())->toBeGreaterThanOrEqual(5);
    expect(ChecklistTemplate::query()->where('slug', 'hr-employee-onboarding')->exists())->toBeTrue();
    Tenancy::end();
});

test('org admin can create template assign instance fill answers and audit', function () {
    Storage::fake('local');

    $created = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/templates', [
            'name' => 'Custom onboarding',
            'category' => 'onboarding',
            'status' => 'published',
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'needs_laptop',
                        'type' => 'single_select',
                        'label' => 'Needs laptop?',
                        'required' => true,
                        'order' => 1,
                        'options' => [
                            ['value' => 'yes', 'label' => 'Yes'],
                            ['value' => 'no', 'label' => 'No'],
                        ],
                    ],
                    [
                        'key' => 'serial',
                        'type' => 'short_text',
                        'label' => 'Serial',
                        'required' => true,
                        'order' => 2,
                        'options' => [],
                        'visible_when' => ['item_key' => 'needs_laptop', 'op' => 'eq', 'value' => 'yes'],
                        'requires' => ['needs_laptop'],
                    ],
                    [
                        'key' => 'done',
                        'type' => 'checkbox',
                        'label' => 'Complete',
                        'required' => true,
                        'order' => 3,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertCreated()
        ->json('data');

    expect($created['current_version'])->toBe(1);

    Tenancy::initialize($this->tenant);
    $target = Target::query()->firstOrFail();
    Tenancy::end();

    $instances = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/instances', [
            'template_id' => $created['id'],
            'target_ids' => [$target->id],
        ])
        ->assertCreated()
        ->json('data');

    $instanceId = $instances[0]['id'];

    asChecklistAdmin($this)
        ->patchJson("/api/v1/org/checklists/instances/{$instanceId}", [
            'answers' => [
                ['item_key' => 'needs_laptop', 'value' => 'yes'],
                ['item_key' => 'serial', 'value' => 'ABC-123'],
                ['item_key' => 'done', 'value' => true],
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_progress');

    asChecklistAdmin($this)
        ->patchJson("/api/v1/org/checklists/instances/{$instanceId}", [
            'status' => 'completed',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.progress_pct', 100);

    $audit = asChecklistAdmin($this)
        ->getJson("/api/v1/org/checklists/instances/{$instanceId}/audit")
        ->assertOk()
        ->json('data');

    expect($audit)->not->toBeEmpty();
    expect(collect($audit)->pluck('event')->all())->toContain('answer_updated');

    Tenancy::initialize($this->tenant);
    expect(Activity::query()->inLog('checklists')->count())->toBeGreaterThan(0);
    expect(ChecklistAnswer::query()->where('instance_id', $instanceId)->count())->toBe(3);
    Tenancy::end();
});

test('apply_to_open syncs schema to open instances and preserves answers by key', function () {
    Tenancy::initialize($this->tenant);
    $target = Target::query()->firstOrFail();
    Tenancy::end();

    $created = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/templates', [
            'name' => 'Sync demo',
            'category' => 'custom',
            'status' => 'published',
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'keep_me',
                        'type' => 'short_text',
                        'label' => 'Keep',
                        'required' => false,
                        'order' => 1,
                        'options' => [],
                    ],
                    [
                        'key' => 'drop_me',
                        'type' => 'checkbox',
                        'label' => 'Drop',
                        'required' => false,
                        'order' => 2,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertCreated()
        ->json('data');

    $instanceId = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/instances', [
            'template_id' => $created['id'],
            'target_ids' => [$target->id],
        ])
        ->assertCreated()
        ->json('data.0.id');

    asChecklistAdmin($this)
        ->patchJson("/api/v1/org/checklists/instances/{$instanceId}", [
            'answers' => [
                ['item_key' => 'keep_me', 'value' => 'preserved'],
                ['item_key' => 'drop_me', 'value' => true],
            ],
        ])
        ->assertOk();

    asChecklistAdmin($this)
        ->patchJson("/api/v1/org/checklists/templates/{$created['id']}", [
            'apply_to_open' => true,
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'keep_me',
                        'type' => 'short_text',
                        'label' => 'Keep updated',
                        'required' => false,
                        'order' => 1,
                        'options' => [],
                    ],
                    [
                        'key' => 'new_field',
                        'type' => 'checkbox',
                        'label' => 'New',
                        'required' => false,
                        'order' => 2,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.current_version', 2);

    $show = asChecklistAdmin($this)
        ->getJson("/api/v1/org/checklists/instances/{$instanceId}")
        ->assertOk()
        ->json('data');

    $keys = collect($show['schema_snapshot']['items'])->pluck('key')->all();
    expect($keys)->toContain('keep_me', 'new_field')->not->toContain('drop_me');

    $answerKeys = collect($show['answers'])->pluck('item_key')->all();
    expect($answerKeys)->toContain('keep_me')->not->toContain('drop_me');
    expect(collect($show['answers'])->firstWhere('item_key', 'keep_me')['value'])->toBe('preserved');
});

test('apply_to_open false leaves open instance schema unchanged', function () {
    Tenancy::initialize($this->tenant);
    $target = Target::query()->firstOrFail();
    Tenancy::end();

    $created = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/templates', [
            'name' => 'No sync',
            'category' => 'custom',
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'a',
                        'type' => 'checkbox',
                        'label' => 'A',
                        'order' => 1,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertCreated()
        ->json('data');

    $instanceId = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/instances', [
            'template_id' => $created['id'],
            'target_ids' => [$target->id],
        ])
        ->json('data.0.id');

    asChecklistAdmin($this)
        ->patchJson("/api/v1/org/checklists/templates/{$created['id']}", [
            'apply_to_open' => false,
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'b',
                        'type' => 'checkbox',
                        'label' => 'B',
                        'order' => 1,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.current_version', 2);

    $show = asChecklistAdmin($this)
        ->getJson("/api/v1/org/checklists/instances/{$instanceId}")
        ->json('data');

    expect(collect($show['schema_snapshot']['items'])->pluck('key')->all())->toBe(['a']);
});

test('checklist routes require org.checklists.manage', function () {
    $learner = User::factory()->create([
        'tenant_id' => 'itneck',
        'email' => 'learner-checklist@itneck.test',
    ]);

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/checklists/templates')
        ->assertForbidden();
});

test('system template cannot be assigned directly and can be copied', function () {
    Tenancy::initialize($this->tenant);
    $system = ChecklistTemplate::query()->where('is_system', true)->firstOrFail();
    $target = Target::query()->firstOrFail();
    Tenancy::end();

    asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/instances', [
            'template_id' => $system->id,
            'target_ids' => [$target->id],
        ])
        ->assertStatus(422);

    $copy = asChecklistAdmin($this)
        ->postJson("/api/v1/org/checklists/templates/{$system->id}/from-system", [
            'name' => 'My onboarding',
        ])
        ->assertCreated()
        ->json('data');

    expect($copy['is_system'])->toBeFalse();
    expect($copy['name'])->toBe('My onboarding');

    asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/instances', [
            'template_id' => $copy['id'],
            'target_ids' => [$target->id],
        ])
        ->assertCreated();
});

test('checklist media upload works for evidence files', function () {
    Storage::fake('local');

    $upload = asChecklistAdmin($this)
        ->post('/api/v1/org/checklists/media/upload', [
            'file' => UploadedFile::fake()->create('evidence.pdf', 40, 'application/pdf'),
        ], ['X-Tenant' => 'itneck'])
        ->assertCreated()
        ->json('data');

    expect($upload['file_disk_path'])->toContain('/checklists/')
        ->and($upload['file_mime'])->toBe('application/pdf');
    Storage::disk('local')->assertExists($upload['file_disk_path']);
});

test('checklist image uploads are stored as webp', function () {
    Storage::fake('local');

    $upload = asChecklistAdmin($this)
        ->post('/api/v1/org/checklists/media/upload', [
            'file' => UploadedFile::fake()->image('photo.jpeg', 48, 48),
        ], ['X-Tenant' => 'itneck'])
        ->assertCreated()
        ->json('data');

    expect($upload['file_disk_path'])->toEndWith('.webp')
        ->and($upload['file_mime'])->toBe('image/webp')
        ->and($upload['original_name'])->toEndWith('.webp');
    Storage::disk('local')->assertExists($upload['file_disk_path']);
});

test('pack crud assign and rejects system templates', function () {
    Tenancy::initialize($this->tenant);
    $system = ChecklistTemplate::query()->where('is_system', true)->firstOrFail();
    $target = Target::query()->firstOrFail();
    Tenancy::end();

    $templateA = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/templates', [
            'name' => 'Pack item A',
            'category' => 'onboarding',
            'status' => 'published',
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'done_a',
                        'type' => 'checkbox',
                        'label' => 'Done A',
                        'required' => false,
                        'order' => 1,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertCreated()
        ->json('data');

    $templateB = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/templates', [
            'name' => 'Pack item B',
            'category' => 'hr_ops',
            'status' => 'published',
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'done_b',
                        'type' => 'checkbox',
                        'label' => 'Done B',
                        'required' => false,
                        'order' => 1,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertCreated()
        ->json('data');

    asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/packs', [
            'name' => 'Bad pack',
            'template_ids' => [$system->id],
        ])
        ->assertStatus(422);

    $pack = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/packs', [
            'name' => 'Welcome pack test',
            'status' => 'published',
            'auto_assign_on_create' => false,
            'template_ids' => [$templateA['id'], $templateB['id']],
        ])
        ->assertCreated()
        ->json('data');

    expect($pack['template_ids'])->toBe([$templateA['id'], $templateB['id']]);

    $created = asChecklistAdmin($this)
        ->postJson("/api/v1/org/checklists/packs/{$pack['id']}/assign", [
            'target_ids' => [$target->id],
        ])
        ->assertCreated()
        ->json('data');

    expect($created)->toHaveCount(2);

    asChecklistAdmin($this)
        ->postJson("/api/v1/org/checklists/packs/{$pack['id']}/assign", [
            'target_ids' => [$target->id],
        ])
        ->assertStatus(422);
});

test('creating a target auto assigns published packs', function () {
    $template = asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/templates', [
            'name' => 'Auto hire checklist',
            'category' => 'onboarding',
            'status' => 'published',
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'welcome',
                        'type' => 'checkbox',
                        'label' => 'Welcome done',
                        'required' => false,
                        'order' => 1,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertCreated()
        ->json('data');

    asChecklistAdmin($this)
        ->postJson('/api/v1/org/checklists/packs', [
            'name' => 'Auto hire pack',
            'status' => 'published',
            'auto_assign_on_create' => true,
            'template_ids' => [$template['id']],
        ])
        ->assertCreated();

    $email = 'new.hire.auto.'.uniqid('', true).'@itneck.test';
    $created = asChecklistAdmin($this)
        ->postJson('/api/v1/org/targets', [
            'email' => $email,
            'first_name' => 'New',
            'last_name' => 'Hire',
        ])
        ->assertCreated()
        ->json();

    expect($created['meta']['auto_assigned_instance_count'])->toBeGreaterThanOrEqual(1);

    $targetId = $created['data']['id'];

    $instances = asChecklistAdmin($this)
        ->getJson('/api/v1/org/checklists/instances?target_id='.$targetId)
        ->assertOk()
        ->json('data');

    expect(collect($instances)->pluck('title')->all())->toContain('Auto hire checklist');
});

test('org admin can show a single target', function () {
    Tenancy::initialize($this->tenant);
    $target = Target::query()->firstOrFail();
    Tenancy::end();

    asChecklistAdmin($this)
        ->getJson("/api/v1/org/targets/{$target->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $target->id)
        ->assertJsonPath('data.email', $target->email);
});

test('welcome pack is seeded for sample tenants', function () {
    Tenancy::initialize($this->tenant);
    expect(ChecklistPack::query()->where('slug', 'welcome-pack')->exists())->toBeTrue();
    $pack = ChecklistPack::query()->where('slug', 'welcome-pack')->firstOrFail();
    expect($pack->auto_assign_on_create)->toBeTrue();
    expect($pack->items()->count())->toBeGreaterThanOrEqual(1);
    Tenancy::end();
});
