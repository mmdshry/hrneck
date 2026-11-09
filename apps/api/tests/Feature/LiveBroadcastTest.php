<?php

use App\Domains\Realtime\Events\LiveTopicBroadcast;
use App\Domains\Realtime\Snapshots\LiveSnapshotBuilder;
use App\Domains\Realtime\Support\LiveChannelGate;
use App\Domains\Realtime\Support\LiveTopics;
use App\Models\Tenant;
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
        ->and($metrics['summary'])->toHaveKeys(['campaigns', 'sent', 'opened']);
});
