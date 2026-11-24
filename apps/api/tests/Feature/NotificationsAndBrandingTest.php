<?php

use App\Domains\Campaigns\Jobs\SendTrainingReminderJob;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Notifications\Events\UserNotificationBroadcast;
use App\Domains\Notifications\Jobs\SendNotificationEmailJob;
use App\Domains\Notifications\Models\OrgAnnouncement;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Facades\Tenancy;

beforeEach(function () {
    $this->tenant = Tenant::query()->findOrFail('itneck');
    $this->admin = orgAdmin();
});

test('announcement fans out notifications and appears in inbox', function () {
    Queue::fake();
    Event::fake([UserNotificationBroadcast::class]);

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/announcements', [
            'title' => 'Office closed Friday',
            'body' => 'Building maintenance day.',
        ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Office closed Friday');

    Tenancy::initialize($this->tenant);
    expect(OrgAnnouncement::query()->where('title', 'Office closed Friday')->exists())->toBeTrue();
    expect(
        UserNotification::query()
            ->where('user_id', $this->admin->id)
            ->where('type', UserNotification::TYPE_ANNOUNCEMENT)
            ->where('title', 'Office closed Friday')
            ->exists()
    )->toBeTrue();
    Tenancy::end();

    Event::assertDispatched(UserNotificationBroadcast::class);

    Queue::assertPushed(SendNotificationEmailJob::class, function (SendNotificationEmailJob $job): bool {
        return strtolower($job->email) === strtolower((string) $this->admin->email)
            && $job->subject === 'Office closed Friday';
    });

    $inbox = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/notifications?page=1&per_page=25')
        ->assertOk()
        ->json();

    expect($inbox['meta']['unread_count'])->toBeGreaterThanOrEqual(1)
        ->and($inbox['meta']['current_page'])->toBe(1)
        ->and($inbox['meta']['per_page'])->toBe(25)
        ->and(collect($inbox['data'])->pluck('title'))->toContain('Office closed Friday');

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/notifications/read', ['all' => true])
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0);
});

test('announcement skips email when target opted out but keeps in-app', function () {
    Queue::fake();
    Event::fake([UserNotificationBroadcast::class]);

    Tenancy::initialize($this->tenant);
    Target::query()->updateOrCreate(
        ['email' => $this->admin->email],
        [
            'first_name' => 'Admin',
            'last_name' => 'User',
            'status' => 'active',
            'notification_opt_out' => true,
        ],
    );
    Tenancy::end();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/announcements', [
            'title' => 'Opted out news',
            'body' => 'No email for opted-out employees.',
        ])
        ->assertCreated();

    Tenancy::initialize($this->tenant);
    expect(
        UserNotification::query()
            ->where('user_id', $this->admin->id)
            ->where('type', UserNotification::TYPE_ANNOUNCEMENT)
            ->where('title', 'Opted out news')
            ->exists()
    )->toBeTrue();
    Tenancy::end();

    Queue::assertNotPushed(SendNotificationEmailJob::class, function (SendNotificationEmailJob $job): bool {
        return strtolower($job->email) === strtolower((string) $this->admin->email);
    });
});

test('training assign notifies matching target user', function () {
    Mail::fake();
    Event::fake([UserNotificationBroadcast::class]);

    Tenancy::initialize($this->tenant);
    $target = Target::query()->firstOrCreate(
        ['email' => $this->admin->email],
        ['first_name' => 'Admin', 'last_name' => 'User', 'status' => 'active'],
    );
    $targetId = $target->id;
    Tenancy::end();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/training/assign', [
            'name' => 'Notify wave',
            'content' => [
                'title' => 'Phishing basics',
                'content_type' => 'text',
                'body' => 'Body',
            ],
            'target_ids' => [$targetId],
            'launch' => true,
        ])
        ->assertCreated();

    Tenancy::initialize($this->tenant);
    expect(
        UserNotification::query()
            ->where('user_id', $this->admin->id)
            ->where('type', UserNotification::TYPE_TRAINING_ASSIGNED)
            ->exists()
    )->toBeTrue();
    Tenancy::end();
});

test('checklist assign notifies matching target user', function () {
    Queue::fake();
    Event::fake([UserNotificationBroadcast::class]);

    $created = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/checklists/templates', [
            'name' => 'Notify checklist',
            'category' => 'onboarding',
            'status' => 'published',
            'schema_json' => [
                'items' => [
                    [
                        'key' => 'done',
                        'type' => 'checkbox',
                        'label' => 'Done',
                        'required' => true,
                        'order' => 1,
                        'options' => [],
                    ],
                ],
            ],
        ])
        ->assertCreated()
        ->json('data');

    Tenancy::initialize($this->tenant);
    $target = Target::query()->updateOrCreate(
        ['email' => $this->admin->email],
        [
            'first_name' => 'Admin',
            'last_name' => 'User',
            'status' => 'active',
            'notification_opt_out' => false,
        ],
    );
    $targetId = $target->id;
    $targetEmail = (string) $target->email;
    Tenancy::end();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/checklists/instances', [
            'template_id' => $created['id'],
            'target_ids' => [$targetId],
        ])
        ->assertCreated();

    Tenancy::initialize($this->tenant);
    expect(
        UserNotification::query()
            ->where('user_id', $this->admin->id)
            ->where('type', UserNotification::TYPE_CHECKLIST_ASSIGNED)
            ->exists()
    )->toBeTrue();
    Tenancy::end();

    Queue::assertPushed(SendNotificationEmailJob::class, function (SendNotificationEmailJob $job) use ($targetEmail): bool {
        return strtolower($job->email) === strtolower($targetEmail)
            && str_contains($job->subject, 'checklist: Notify checklist');
    });
});

test('ticket assignment creates notification for assignee', function () {
    Queue::fake();
    Event::fake([UserNotificationBroadcast::class]);

    Tenancy::initialize($this->tenant);
    $deskId = SdDesk::query()->where('slug', 'incident')->value('id');
    Target::query()->whereRaw('lower(email) = ?', [strtolower((string) $this->admin->email)])
        ->update(['notification_opt_out' => false]);
    Tenancy::end();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'Assigned notice',
            'assignee_user_id' => $this->admin->id,
        ])
        ->assertCreated();

    Tenancy::initialize($this->tenant);
    expect(
        UserNotification::query()
            ->where('user_id', $this->admin->id)
            ->where('type', UserNotification::TYPE_TICKET_ASSIGNED)
            ->where('title', 'Ticket assigned to you')
            ->exists()
    )->toBeTrue();
    Tenancy::end();

    Queue::assertPushed(SendNotificationEmailJob::class, function (SendNotificationEmailJob $job): bool {
        return strtolower($job->email) === strtolower((string) $this->admin->email)
            && str_starts_with($job->subject, '[Ticketing] assigned:');
    });
});

test('training reminder skips email when target opted out', function () {
    Mail::fake();

    Tenancy::initialize($this->tenant);

    $courseId = Course::query()->value('id');
    $target = Target::query()->firstOrFail();
    $target->forceFill(['notification_opt_out' => true])->save();

    $campaign = Campaign::query()->create([
        'name' => 'Opt-out wave',
        'type' => 'training',
        'status' => 'running',
        'course_id' => $courseId,
        'starts_at' => now(),
    ]);

    $enrollment = Enrollment::query()->firstOrCreate(
        ['course_id' => $courseId, 'target_id' => $target->id],
        ['status' => 'assigned', 'progress' => 0],
    );

    $recipient = CampaignRecipient::query()->create([
        'campaign_id' => $campaign->id,
        'target_id' => $target->id,
        'status' => 'pending',
    ]);

    (new SendTrainingReminderJob($recipient->id, $enrollment->id))->handle();

    expect($recipient->fresh()->status)->toBe('pending');
    Mail::assertNothingSent();
    Tenancy::end();
});

test('branding is readable by org members and logo can be uploaded', function () {
    Storage::fake('local');

    $branding = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/branding')
        ->assertOk()
        ->json('data');

    expect($branding['primary_color'])->not->toBeNull();

    $uploaded = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/settings/logo', [
            'file' => UploadedFile::fake()->image('logo.png', 64, 64),
        ])
        ->assertOk()
        ->assertJsonPath('data.logo_url', '/api/v1/org/branding/logo')
        ->json('data');

    expect($uploaded['logo_path'])->toEndWith('.webp');

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->get('/api/v1/org/branding/logo')
        ->assertOk()
        ->assertHeader('Content-Type', 'image/webp');

    // Browser <img> requests cannot send X-Tenant; query tenant must work.
    $this->actingAs($this->admin)
        ->get('/api/v1/org/branding/logo?tenant=itneck')
        ->assertOk()
        ->assertHeader('Content-Type', 'image/webp');
});

test('branding logo upload rejects svg files', function () {
    Storage::fake('local');

    $svg = UploadedFile::fake()->createWithContent(
        'logo.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/settings/logo', [
            'file' => $svg,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['file']);
});

test('announcements list is available to members', function () {
    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/announcements', [
            'title' => 'Listed',
            'body' => 'Body',
        ])
        ->assertCreated();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/announcements')
        ->assertOk()
        ->assertJsonFragment(['title' => 'Listed']);
});

test('deleting an announcement removes its notifications', function () {
    $created = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/announcements', [
            'title' => 'Gone soon',
            'body' => 'This should leave the bell.',
        ])
        ->assertCreated();

    $id = (int) $created->json('data.id');

    Tenancy::initialize($this->tenant);
    expect(
        UserNotification::query()->where('data->announcement_id', $id)->count()
    )->toBeGreaterThan(0);
    Tenancy::end();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->deleteJson('/api/v1/org/announcements/'.$id)
        ->assertOk();

    Tenancy::initialize($this->tenant);
    expect(UserNotification::query()->where('data->announcement_id', $id)->count())->toBe(0);
    Tenancy::end();
});
