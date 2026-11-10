<?php

use App\Domains\Realtime\Events\LiveTopicBroadcast;
use App\Domains\Realtime\Snapshots\LiveSnapshotBuilder;
use App\Domains\Realtime\Support\LiveChannelGate;
use App\Domains\Realtime\Support\LiveTopics;
use App\Models\Tenant;
use App\Support\StaffTenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Stancl\Tenancy\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('msp live channel gate allows platform staff only', function () {
    $gate = app(LiveChannelGate::class);

    expect($gate->allowsMsp(platformAdmin()))->toBeTrue()
        ->and($gate->allowsMsp(orgAdmin()))->toBeFalse();
});

test('org metrics channel gate requires membership', function () {
    $gate = app(LiveChannelGate::class);

    expect($gate->allowsOrgTopic(orgAdmin('itneck'), 'itneck', LiveTopics::METRICS))->toBeTrue()
        ->and($gate->allowsOrgTopic(orgAdmin('itneck'), 'company', LiveTopics::METRICS))->toBeFalse()
        ->and($gate->allowsOrgTopic(orgAdmin('itneck'), 'itneck', 'unknown-topic'))->toBeFalse();
});

test('org topic gate allows platform staff with matching staff tenant session', function () {
    $gate = app(LiveChannelGate::class);
    $staff = platformAdmin();

    expect($gate->allowsOrgTopic($staff, 'itneck', LiveTopics::REPORTS))->toBeFalse()
        ->and($gate->allowsOrgTopic($staff, 'itneck', LiveTopics::METRICS))->toBeFalse();

    $this->actingAs($staff)
        ->withHeader('Origin', 'http://hrneck.test')
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    expect(StaffTenant::id())->toBe('itneck')
        ->and($gate->allowsOrgTopic($staff, 'itneck', LiveTopics::REPORTS))->toBeTrue()
        ->and($gate->allowsOrgTopic($staff, 'itneck', LiveTopics::METRICS))->toBeTrue()
        ->and($gate->allowsOrgTopic($staff, 'itneck', LiveTopics::REPORTS_DETAILED))->toBeTrue()
        ->and($gate->allowsOrgTopic($staff, 'company', LiveTopics::REPORTS))->toBeFalse();
});

test('msp tenant update broadcasts live topic event', function () {
    Event::fake([LiveTopicBroadcast::class]);

    $this->actingAs(platformAdmin())
        ->putJson('/api/v1/msp/tenants/itneck', [
            'name' => 'ITneck Updated',
        ])
        ->assertOk();

    Event::assertDispatched(LiveTopicBroadcast::class, function (LiveTopicBroadcast $event): bool {
        return $event->channelName === LiveTopics::mspChannel()
            && $event->eventName === 'updated'
            && is_array($event->payload['data'] ?? null);
    });
});

test('sending profile create broadcasts org topic', function () {
    Event::fake([LiveTopicBroadcast::class]);

    $this->actingAs(orgAdmin('itneck'))
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/sending-profiles', [
            'name' => 'Live SMTP',
            'from_name' => 'HRNECK',
            'from_email' => 'noreply@itneck.test',
            'mailer' => 'smtp',
            'is_default' => true,
        ])
        ->assertCreated();

    Event::assertDispatched(LiveTopicBroadcast::class, function (LiveTopicBroadcast $event): bool {
        return $event->channelName === LiveTopics::orgChannel('itneck', LiveTopics::SENDING_PROFILES)
            && $event->eventName === 'updated';
    });
});

test('snapshot builder returns msp tenants and org metrics', function () {
    $builder = app(LiveSnapshotBuilder::class);

    $msp = $builder->forMsp();
    expect($msp['data'])->toBeArray()->not->toBeEmpty();

    app(Tenancy::class)->initialize(Tenant::query()->findOrFail('itneck'));
    $metrics = $builder->forOrgTopic(LiveTopics::METRICS);
    expect($metrics)->toHaveKey('summary')
        ->and($metrics['summary'])->toHaveKeys(['campaigns', 'recipients', 'opened', 'completed']);
});

test('org tickets and users topics require matching permissions', function () {
    $gate = app(LiveChannelGate::class);
    $admin = orgAdmin('itneck');

    expect($gate->allowsOrgTopic($admin, 'itneck', LiveTopics::TICKETS))->toBeTrue()
        ->and($gate->allowsOrgTopic($admin, 'itneck', LiveTopics::USERS))->toBeTrue()
        ->and($gate->allowsOrgTopic($admin, 'itneck', LiveTopics::TRAINING))->toBeTrue()
        ->and($gate->allowsOrgTopic($admin, 'itneck', LiveTopics::CHECKLIST_INSTANCES))->toBeTrue()
        ->and($gate->allowsOrgTopic($admin, 'company', LiveTopics::TICKETS))->toBeFalse();
});

test('org user create broadcasts users topic', function () {
    Event::fake([LiveTopicBroadcast::class]);

    $this->actingAs(orgAdmin('itneck'))
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/users', [
            'name' => 'Live User',
            'email' => 'live-user-'.uniqid('', true).'@itneck.test',
            'password' => 'password123',
            'roles' => ['org_admin'],
        ])
        ->assertCreated();

    Event::assertDispatched(LiveTopicBroadcast::class, function (LiveTopicBroadcast $event): bool {
        return $event->channelName === LiveTopics::orgChannel('itneck', LiveTopics::USERS)
            && $event->eventName === 'updated';
    });
});

test('announcement create broadcasts announcements topic', function () {
    Event::fake([LiveTopicBroadcast::class]);

    $this->actingAs(orgAdmin('itneck'))
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/announcements', [
            'title' => 'Live announcement',
            'body' => 'Body for live broadcast test',
        ])
        ->assertCreated();

    Event::assertDispatched(LiveTopicBroadcast::class, function (LiveTopicBroadcast $event): bool {
        return $event->channelName === LiveTopics::orgChannel('itneck', LiveTopics::ANNOUNCEMENTS)
            && $event->eventName === 'updated';
    });
});

test('snapshot builder covers new org topics', function () {
    app(Tenancy::class)->initialize(Tenant::query()->findOrFail('itneck'));
    $builder = app(LiveSnapshotBuilder::class);

    expect($builder->forOrgTopic(LiveTopics::USERS))->toHaveKey('data')
        ->and($builder->forOrgTopic(LiveTopics::TICKETS))->toHaveKey('data')
        ->and($builder->forOrgTopic(LiveTopics::TRAINING))->toHaveKeys(['courses', 'enrollments'])
        ->and($builder->forOrgTopic(LiveTopics::REPORTS_DETAILED))->toHaveKey('overview')
        ->and($builder->forOrgTopic(LiveTopics::BRANDING))->toHaveKey('data');
});
