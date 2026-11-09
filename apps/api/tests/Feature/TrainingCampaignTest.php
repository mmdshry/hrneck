<?php

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('org can launch training campaign and queue reminders', function () {
    Mail::fake();

    $user = orgAdmin();
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $courseId = Course::query()->value('id');
    $targetIds = Target::query()->limit(2)->pluck('id')->all();
    Tenancy::end();

    expect($courseId)->not->toBeNull()->and($targetIds)->not->toBeEmpty();

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'Training wave',
            'type' => 'training',
            'course_id' => $courseId,
            'target_ids' => $targetIds,
            'launch' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'training')
        ->assertJsonPath('data.status', 'running');

    Tenancy::initialize($tenant);
    $campaign = Campaign::query()->where('type', 'training')->where('name', 'Training wave')->with('recipients')->firstOrFail();
    expect($campaign->recipients)->toHaveCount(count($targetIds));
    expect($campaign->recipients->every(fn ($r) => $r->status === 'sent'))->toBeTrue();
    Tenancy::end();
});
