<?php

use App\Domains\Campaigns\Actions\RecordPhishingRecipientEvent;
use App\Domains\Campaigns\Actions\ResolveCampaignAudience;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Checklists\Actions\CreateChecklistInstances;
use App\Domains\Checklists\Models\ChecklistAnswer;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Checklists\Models\ChecklistTemplateVersion;
use App\Domains\TargetsGroups\Actions\RecalculateTargetRisk;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\ResolveActiveTarget;
use App\Domains\TargetsGroups\Support\TargetProfileFields;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('creating a target links user_id and stores profile fields', function () {
    Queue::fake();
    $admin = orgAdmin();

    $managerResponse = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'manager.boss@example.test',
            'first_name' => 'Boss',
            'last_name' => 'Manager',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    $managerId = (int) $managerResponse->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'profile.hire@example.test',
            'first_name' => 'Profile',
            'last_name' => 'Hire',
            'job_title' => 'Analyst',
            'hire_date' => '2026-01-15',
            'employee_number' => 'E-100',
            'phone' => '+989121234567',
            'location' => 'Iran/Tehran',
            'employment_type' => 'full_time',
            'preferred_language' => 'fa',
            'timezone' => 'Asia/Tehran',
            'manager_target_id' => $managerId,
            'risk_score' => 40,
            'risk_tier' => 'high',
        ])
        ->assertCreated()
        ->assertJsonPath('data.job_title', 'Analyst')
        ->assertJsonPath('data.employment_type', 'full_time')
        ->assertJsonPath('data.preferred_language', 'en')
        ->assertJsonPath('data.location', 'Iran/Tehran')
        ->assertJsonPath('data.risk_score', 5)
        ->assertJsonPath('data.risk_tier', 'low')
        ->assertJsonPath('data.risk_source', TargetProfileFields::RISK_SOURCE_COMPUTED)
        ->assertJsonPath('data.joined_via', 'manual');

    $user = User::query()->whereRaw('LOWER(email) = ?', ['profile.hire@example.test'])->first();
    expect($user)->not->toBeNull();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->where('email', 'profile.hire@example.test')->first();
    expect($target)->not->toBeNull();
    expect($target->user_id)->toBe($user->id);
    expect($target->manager_target_id)->toBe($managerId);
    expect($target->hire_date?->toDateString())->toBe('2026-01-15');

    $resolved = app(ResolveActiveTarget::class)->forUser($user);
    expect($resolved?->id)->toBe($target->id);
    Tenancy::end();
});

test('updating a target ignores client risk fields and rejects invalid locations', function () {
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'profile.update@example.test',
            'timezone' => 'UTC',
            'location' => 'Iran/Tehran',
            'preferred_language' => 'es',
        ])
        ->assertCreated();

    $id = (int) $created->json('data.id');
    $scoreBefore = (int) $created->json('data.risk_score');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson("/api/v1/org/targets/{$id}", [
            'risk_score' => 99,
            'risk_tier' => 'high',
            'preferred_language' => 'de',
        ])
        ->assertOk()
        ->assertJsonPath('data.preferred_language', 'de')
        ->assertJsonPath('data.risk_score', $scoreBefore)
        ->assertJsonPath('data.risk_source', TargetProfileFields::RISK_SOURCE_COMPUTED);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson("/api/v1/org/targets/{$id}", [
            'location' => 'NotARealPlace/Nowhere',
        ])
        ->assertStatus(422);
});

test('csv import accepts extended headers and manager_email', function () {
    $admin = orgAdmin();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    Target::query()->create([
        'email' => 'csv.manager@example.test',
        'first_name' => 'Csv',
        'last_name' => 'Manager',
        'status' => 'active',
    ]);
    Tenancy::end();

    $csv = implode("\n", [
        'email,first_name,last_name,department,job_title,employee_number,phone,location,employment_type,hire_date,manager_email,preferred_language,timezone,external_id,risk_score,risk_tier',
        'csv.report@example.test,Csv,Report,Security,Engineer,E-200,+1000,Iran/Tehran,contractor,2025-11-01,csv.manager@example.test,en,UTC,ext-200,12,low',
        '',
    ]);
    $file = UploadedFile::fake()->createWithContent('targets.csv', $csv);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/import', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('imported', 1);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $target = Target::query()->where('email', 'csv.report@example.test')->first();
    $manager = Target::query()->where('email', 'csv.manager@example.test')->first();
    expect($target)->not->toBeNull();
    expect($target->job_title)->toBe('Engineer');
    expect($target->employee_number)->toBe('E-200');
    expect($target->employment_type)->toBe('contractor');
    expect($target->location)->toBe('Iran/Tehran');
    expect($target->joined_via)->toBe('csv');
    expect($target->manager_target_id)->toBe($manager?->id);
    expect($target->risk_source)->toBe(TargetProfileFields::RISK_SOURCE_COMPUTED);
    expect($target->risk_score)->toBe(5);
    expect($target->risk_tier)->toBe('low');
    Tenancy::end();
});

test('resolve campaign audience excludes inactive targets', function () {
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $active = Target::query()->create([
        'email' => 'audience.active@example.test',
        'status' => 'active',
    ]);
    $inactive = Target::query()->create([
        'email' => 'audience.inactive@example.test',
        'status' => 'inactive',
    ]);
    $group = Group::query()->create([
        'name' => 'Mixed audience',
        'source' => 'manual',
        'status' => 'active',
    ]);
    $group->targets()->sync([$active->id, $inactive->id]);

    $ids = app(ResolveCampaignAudience::class)->handle([], [$group->id]);
    expect($ids)->toBe([$active->id]);

    expect(fn () => app(ResolveCampaignAudience::class)->handle([$inactive->id], []))
        ->toThrow(ValidationException::class);

    Tenancy::end();
});

test('checklist instances prefill from target profile', function () {
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $manager = Target::query()->create([
        'email' => 'prefill.manager@example.test',
        'status' => 'active',
    ]);
    $target = Target::query()->create([
        'email' => 'prefill.employee@example.test',
        'status' => 'active',
        'job_title' => 'Security Lead',
        'hire_date' => '2026-02-01',
        'manager_target_id' => $manager->id,
    ]);

    $template = ChecklistTemplate::query()->create([
        'name' => 'Prefill Template',
        'slug' => 'prefill-template-'.uniqid(),
        'category' => 'onboarding',
        'status' => 'published',
        'is_system' => false,
        'current_version' => 1,
    ]);
    ChecklistTemplateVersion::query()->create([
        'template_id' => $template->id,
        'version' => 1,
        'schema_json' => [
            'items' => [
                ['key' => 'role_title', 'type' => 'short_text', 'label' => 'Role'],
                ['key' => 'start_date', 'type' => 'date', 'label' => 'Start'],
                ['key' => 'manager_email', 'type' => 'short_text', 'label' => 'Manager'],
            ],
        ],
    ]);

    $instances = app(CreateChecklistInstances::class)->handle($template, [$target->id], []);
    expect($instances)->toHaveCount(1);

    $answers = ChecklistAnswer::query()
        ->where('instance_id', $instances[0]->id)
        ->get()
        ->mapWithKeys(fn (ChecklistAnswer $answer) => [$answer->item_key => $answer->decodedValue()]);

    expect($answers['role_title'] ?? null)->toBe('Security Lead');
    expect($answers['start_date'] ?? null)->toBe('2026-02-01');
    expect($answers['manager_email'] ?? null)->toBe('prefill.manager@example.test');
    expect($instances[0]->fresh()->status)->toBe('in_progress');

    Tenancy::end();
});

test('phishing events recalculate target risk score and tier', function () {
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));

    $target = Target::query()->create([
        'email' => 'risk.user@example.test',
        'status' => 'active',
        'risk_score' => 0,
        'risk_tier' => 'unknown',
    ]);

    $campaign = Campaign::query()->create([
        'name' => 'Phish sim',
        'type' => 'phishing',
        'status' => 'running',
    ]);
    $recipient = CampaignRecipient::query()->create([
        'campaign_id' => $campaign->id,
        'target_id' => $target->id,
        'status' => 'sent',
        'sent_at' => now(),
    ]);

    app(RecordPhishingRecipientEvent::class)->handle($recipient, 'clicked');
    $target->refresh();
    expect($target->risk_score)->toBeGreaterThan(0);
    expect($target->risk_source)->toBe(TargetProfileFields::RISK_SOURCE_COMPUTED);

    app(RecordPhishingRecipientEvent::class)->handle($recipient->fresh(), 'submitted');
    $target->refresh();
    expect($target->risk_score)->toBeGreaterThanOrEqual(45);
    expect($target->risk_tier)->toBeIn(['medium', 'high']);

    $beforeManual = $target->risk_score;
    $target->forceFill([
        'risk_score' => 10,
        'risk_tier' => 'low',
        'risk_source' => TargetProfileFields::RISK_SOURCE_MANUAL,
        'risk_updated_at' => now()->addMinute(),
    ])->save();

    app(RecalculateTargetRisk::class)->handle($target->fresh());
    $target->refresh();
    expect($target->risk_source)->toBe(TargetProfileFields::RISK_SOURCE_COMPUTED);
    expect($target->risk_score)->toBeGreaterThan(10);

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/targets/{$target->id}/recalculate-risk")
        ->assertOk()
        ->assertJsonPath('data.risk_source', TargetProfileFields::RISK_SOURCE_COMPUTED);

    expect($target->fresh()->risk_score)->not->toBe($beforeManual > 10 ? 10 : $beforeManual);
    expect($target->fresh()->risk_score)->toBeGreaterThan(10);

    Tenancy::end();
});

test('employee cannot be their own manager', function () {
    $admin = orgAdmin();

    $created = $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/targets', [
            'email' => 'self.manager@example.test',
            'first_name' => 'Self',
            'timezone' => 'UTC',
        ])
        ->assertCreated();

    $id = (int) $created->json('data.id');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson("/api/v1/org/targets/{$id}", [
            'manager_target_id' => $id,
        ])
        ->assertStatus(422);
});
