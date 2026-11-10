<?php

use App\Domains\Campaigns\Actions\MaybeCompleteTrainingCampaign;
use App\Domains\Campaigns\Jobs\SendTrainingReminderJob;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('campaign auto-completes when all recipients are done', function () {
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);

    $courseId = Course::query()->value('id');
    $targetId = Target::query()->value('id');

    $campaign = Campaign::query()->create([
        'name' => 'Complete me',
        'type' => 'training',
        'status' => 'running',
        'course_id' => $courseId,
        'starts_at' => now(),
    ]);

    CampaignRecipient::query()->create([
        'campaign_id' => $campaign->id,
        'target_id' => $targetId,
        'status' => 'completed',
    ]);

    app(MaybeCompleteTrainingCampaign::class)->handle($campaign->fresh());

    expect($campaign->fresh()->status)->toBe('completed');
    Tenancy::end();
});

test('cancelled campaign skips reminder job send', function () {
    Mail::fake();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);

    $courseId = Course::query()->value('id');
    $targetId = Target::query()->value('id');

    $campaign = Campaign::query()->create([
        'name' => 'Cancelled wave',
        'type' => 'training',
        'status' => 'cancelled',
        'course_id' => $courseId,
    ]);

    $enrollment = Enrollment::query()->firstOrCreate(
        ['course_id' => $courseId, 'target_id' => $targetId],
        ['status' => 'assigned', 'progress' => 0],
    );

    $recipient = CampaignRecipient::query()->create([
        'campaign_id' => $campaign->id,
        'target_id' => $targetId,
        'status' => 'pending',
    ]);

    (new SendTrainingReminderJob($recipient->id, $enrollment->id))->handle();

    expect($recipient->fresh()->status)->toBe('pending');
    Mail::assertNothingSent();
    Tenancy::end();
});

test('org can cancel a running campaign via patch', function () {
    Mail::fake();
    $user = orgAdmin();
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);
    $courseId = Course::query()->value('id');
    $targetIds = Target::query()->limit(1)->pluck('id')->all();
    Tenancy::end();

    $created = $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/campaigns', [
            'name' => 'To cancel',
            'course_id' => $courseId,
            'target_ids' => $targetIds,
            'launch' => true,
        ])
        ->assertCreated();

    $id = (int) $created->json('data.id');

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->patchJson('/api/v1/org/campaigns/'.$id, ['status' => 'cancelled'])
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');
});
