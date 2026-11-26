<?php

use App\Domains\Assistant\Models\AssistantConversation;
use App\Domains\Assistant\Models\AssistantPendingAction;
use App\Domains\Assistant\Support\AssistantPendingActionStatus;
use App\Domains\Assistant\Support\ConversationToken;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdTicket;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Facades\Tenancy;
use Tests\TestCase;

beforeEach(function () {
    config([
        'services.copilot_studio.direct_line_secret' => 'dl-test-secret',
        'services.copilot_studio.connector_api_key' => 'connector-test-key',
        'services.copilot_studio.pilot_tenant_ids' => ['itneck'],
        'services.copilot_studio.poll_interval_ms' => 0,
        'services.copilot_studio.reply_timeout_seconds' => 1,
    ]);

    $this->admin = orgAdmin();
});

/**
 * Fakes Direct Line. Each message consumes one batch of bot replies, followed by an empty poll that ends the reader.
 *
 * @param  list<list<string>>  $botBatches
 */
function assistantFakeDirectLine(array $botBatches = [['Here is what I found.']]): void
{
    $pollResponses = [];
    foreach ($botBatches as $batch) {
        $pollResponses[] = array_map(
            static fn (string $text, int $index): array => [
                'id' => 'bot-'.$index.'-'.md5($text),
                'type' => 'message',
                'from' => ['id' => 'copilot-bot'],
                'text' => $text,
            ],
            $batch,
            array_keys($batch),
        );
        $pollResponses[] = [];
    }

    Http::fake(function (HttpRequest $request) use (&$pollResponses) {
        if ($request->method() === 'POST' && str_ends_with($request->url(), '/v3/directline/conversations')) {
            return Http::response(['conversationId' => 'dl-conv-1', 'token' => 'dl-token-1'], 201);
        }

        if ($request->method() === 'POST') {
            return Http::response(['id' => 'activity-sent'], 200);
        }

        return Http::response(['activities' => array_shift($pollResponses) ?? [], 'watermark' => '1']);
    });
}

function assistantConversationFor(User $user, array $overrides = []): AssistantConversation
{
    return AssistantConversation::query()->create(array_merge([
        'tenant_id' => 'itneck',
        'user_id' => $user->id,
        'copilot_conversation_id' => 'dl-conv-1',
        'direct_line_token' => 'dl-token-1',
        'expires_at' => now()->addMinutes(30),
    ], $overrides));
}

/**
 * @return array<string, string>
 */
function assistantConnectorHeaders(string $token, string $apiKey = 'connector-test-key'): array
{
    return [
        'X-Assistant-Api-Key' => $apiKey,
        'X-Assistant-Token' => $token,
    ];
}

function assistantLearner(): User
{
    return app(CreateOrgUser::class)->handle(
        'itneck',
        'Assistant Learner',
        'assistant.learner@itneck.test',
        'DemoPass!234',
        [OrgPermissionCatalog::LEARNER],
    );
}

function assistantIncidentDeskId(): int
{
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $id = (int) SdDesk::query()->where('slug', 'incident')->value('id');
    Tenancy::end();

    return $id;
}

function assistantTicketCount(): int
{
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $count = SdTicket::query()->count();
    Tenancy::end();

    return $count;
}

/**
 * Proposes a ticket through the connector the way the agent would, and returns the pending action id.
 */
function assistantProposeTicket(TestCase $test, User $user, string $summary): int
{
    $conversation = assistantConversationFor($user);

    return (int) $test->withHeaders(assistantConnectorHeaders(ConversationToken::issue($conversation->id)))
        ->postJson('/api/v1/assistant/tools/ticket_create', [
            'desk_id' => assistantIncidentDeskId(),
            'summary' => $summary,
        ])
        ->assertStatus(202)
        ->json('pending_action_id');
}

test('assistant status is off for tenants outside the pilot list', function () {
    config(['services.copilot_studio.pilot_tenant_ids' => []]);

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/assistant/status')
        ->assertOk()
        ->assertJsonPath('data.enabled', false)
        ->assertJsonPath('data.tools', []);
});

test('assistant status lists only the tools the member can use', function () {
    $adminTools = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/assistant/status')
        ->assertOk()
        ->assertJsonPath('data.enabled', true)
        ->json('data.tools');

    $names = array_column($adminTools, 'name');
    expect($names)->toContain('tickets_search', 'ticket_create', 'training_campaign_summary');

    $learner = assistantLearner();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/assistant/status')
        ->assertOk()
        ->assertJsonPath('data.enabled', false)
        ->assertJsonPath('data.tools', []);
});

test('starting a conversation is refused outside the pilot tenants', function () {
    config(['services.copilot_studio.pilot_tenant_ids' => []]);
    Http::fake();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/assistant/conversations')
        ->assertForbidden();

    Http::assertNothingSent();
});

test('platform staff acting in a tenant can start a conversation', function () {
    assistantFakeDirectLine();
    $staff = platformAdmin();

    $this->actingAs($staff)
        ->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    $this->actingAs($staff)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/assistant/conversations')
        ->assertCreated()
        ->assertJsonStructure(['data' => ['id', 'expires_at']]);
});

test('platform staff not acting in a tenant cannot start a conversation', function () {
    assistantFakeDirectLine();

    $this->actingAs(platformAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/assistant/conversations')
        ->assertForbidden();
});

test('a staff conversation runs tools without a browser session', function () {
    assistantFakeDirectLine();
    $staff = platformAdmin();

    $this->actingAs($staff)
        ->withHeaders(['Origin' => 'http://hrneck.test'])
        ->postJson('/api/v1/msp/tenants/itneck/enter')
        ->assertOk();

    $conversation = assistantConversationFor($staff);

    // Copilot Studio calls the connector with no session, so the staff tenant must come from the conversation.
    $this->flushSession();

    $this->withHeaders(assistantConnectorHeaders(ConversationToken::issue($conversation->id)))
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => ''])
        ->assertOk()
        ->assertJsonStructure(['data' => ['tickets']]);

    $pendingId = assistantProposeTicket($this, $staff, 'Printer on fire');

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $proposedBy = AssistantPendingAction::query()->whereKey($pendingId)->value('user_id');
    Tenancy::end();

    expect($proposedBy)->toBe($staff->id);
});

test('starting a conversation returns an id without exposing Direct Line secrets', function () {
    assistantFakeDirectLine();

    $response = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/assistant/conversations')
        ->assertCreated()
        ->assertJsonStructure(['data' => ['id', 'expires_at']]);

    $response->assertDontSee('dl-token-1')->assertDontSee('dl-test-secret');

    $conversation = AssistantConversation::query()->findOrFail($response->json('data.id'));

    expect($conversation->user_id)->toBe($this->admin->id)
        ->and($conversation->tenant_id)->toBe('itneck')
        ->and($conversation->direct_line_token)->toBe('dl-token-1')
        ->and($conversation->getRawOriginal('direct_line_token'))->not->toBe('dl-token-1');
});

test('a chat message is sent with the signed conversation token and returns the bot reply', function () {
    assistantFakeDirectLine([['Here is what I found.']]);

    $conversationId = $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/assistant/conversations')
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/conversations/{$conversationId}/messages", [
            'message' => 'Show my open tickets',
        ])
        ->assertOk()
        ->assertJsonPath('data.replies.0.text', 'Here is what I found.')
        ->assertJsonPath('data.pending_actions', []);

    Http::assertSent(function (HttpRequest $request) use ($conversationId) {
        if ($request->method() !== 'POST' || ! str_ends_with($request->url(), '/activities')) {
            return false;
        }

        $data = $request->data();
        $token = $data['channelData']['hrneck']['assistantToken'] ?? '';

        return ($data['text'] ?? null) === 'Show my open tickets'
            && ConversationToken::conversationIdFrom($token) === $conversationId;
    });
});

test('another member cannot send messages into someone else conversation', function () {
    Http::fake();
    $conversation = assistantConversationFor($this->admin);
    $learner = assistantLearner();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/conversations/{$conversation->id}/messages", ['message' => 'hi'])
        ->assertNotFound();

    Http::assertNothingSent();
});

test('a message on an ended conversation is refused', function () {
    Http::fake();
    $conversation = assistantConversationFor($this->admin, ['expires_at' => now()->subMinute()]);

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/conversations/{$conversation->id}/messages", ['message' => 'hi'])
        ->assertStatus(409);

    Http::assertNothingSent();
});

test('Copilot Studio outages return 503 instead of a server error', function () {
    Http::fake(['*' => Http::response(['error' => 'unavailable'], 500)]);

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/assistant/conversations')
        ->assertStatus(503);
});

test('the connector rejects requests without the connector key', function () {
    $conversation = assistantConversationFor($this->admin);
    $token = ConversationToken::issue($conversation->id);

    $this->withHeader('X-Assistant-Token', $token)
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn'])
        ->assertUnauthorized();

    $this->withHeaders(assistantConnectorHeaders($token, 'wrong-key'))
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn'])
        ->assertUnauthorized();
});

test('the conversation token can be sent in the body when the header is absent', function () {
    $token = ConversationToken::issue(assistantConversationFor($this->admin)->id);

    $this->withHeader('X-Assistant-Api-Key', 'connector-test-key')
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn', 'assistant_token' => $token])
        ->assertOk();

    $this->withHeader('X-Assistant-Api-Key', 'connector-test-key')
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn', 'assistant_token' => 'forged.token'])
        ->assertUnauthorized();
});

test('the conversation_ref body field carries the token and is never stored', function () {
    $token = ConversationToken::issue(assistantConversationFor($this->admin)->id);

    $this->withHeader('X-Assistant-Api-Key', 'connector-test-key')
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn', 'conversation_ref' => $token])
        ->assertOk();

    $this->withHeader('X-Assistant-Api-Key', 'connector-test-key')
        ->postJson('/api/v1/assistant/tools/ticket_create', [
            'desk_id' => assistantIncidentDeskId(),
            'summary' => 'Ref in body',
            'conversation_ref' => $token,
        ])
        ->assertStatus(202);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $action = AssistantPendingAction::query()->where('summary', 'like', '%Ref in body%')->firstOrFail();
    expect($action->input)->not->toHaveKey('conversation_ref')
        ->and(json_encode($action->input))->not->toContain($token);
    Tenancy::end();
});

test('the body token is not stored with a proposed write', function () {
    $token = ConversationToken::issue(assistantConversationFor($this->admin)->id);

    $this->withHeader('X-Assistant-Api-Key', 'connector-test-key')
        ->postJson('/api/v1/assistant/tools/ticket_create', [
            'desk_id' => assistantIncidentDeskId(),
            'summary' => 'Token in body',
            'assistant_token' => $token,
        ])
        ->assertStatus(202);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $action = AssistantPendingAction::query()->where('summary', 'like', '%Token in body%')->firstOrFail();
    expect($action->input)->not->toHaveKey('assistant_token')
        ->and(json_encode($action->input))->not->toContain($token);
    Tenancy::end();
});

test('forged, malformed, expired and revoked conversation tokens are rejected', function () {
    $valid = assistantConversationFor($this->admin);
    $expired = assistantConversationFor($this->admin, ['expires_at' => now()->subMinute()]);
    $revoked = assistantConversationFor($this->admin, ['revoked_at' => now()]);

    $rejected = [
        $valid->id.'.'.str_repeat('a', 64),
        'not-a-token',
        ConversationToken::issue($expired->id),
        ConversationToken::issue($revoked->id),
    ];

    foreach ($rejected as $token) {
        $this->withHeaders(assistantConnectorHeaders($token))
            ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn'])
            ->assertUnauthorized();
    }

    $this->withHeaders(assistantConnectorHeaders(ConversationToken::issue($valid->id)))
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn'])
        ->assertOk();
});

test('a member without a permission cannot run the tools that need it', function () {
    $learner = assistantLearner();
    $headers = assistantConnectorHeaders(ConversationToken::issue(assistantConversationFor($learner)->id));

    $this->withHeaders($headers)
        ->postJson('/api/v1/assistant/tools/tickets_search', ['q' => 'vpn'])
        ->assertForbidden();

    $this->withHeaders($headers)
        ->postJson('/api/v1/assistant/tools/training_campaign_summary', [])
        ->assertForbidden();

    $this->withHeaders($headers)
        ->postJson('/api/v1/assistant/tools/ticket_create', [
            'desk_id' => assistantIncidentDeskId(),
            'summary' => 'Should be refused',
        ])
        ->assertForbidden();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(AssistantPendingAction::query()->count())->toBe(0);
    Tenancy::end();
});

test('unknown tools and invalid tool input are rejected', function () {
    $headers = assistantConnectorHeaders(ConversationToken::issue(assistantConversationFor($this->admin)->id));

    $this->withHeaders($headers)
        ->postJson('/api/v1/assistant/tools/delete_everything', [])
        ->assertNotFound();

    $this->withHeaders($headers)
        ->postJson('/api/v1/assistant/tools/ticket_create', ['desk_id' => assistantIncidentDeskId()])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Invalid tool input.');
});

test('the tenant comes from the conversation, not from the X-Tenant header', function () {
    $headers = assistantConnectorHeaders(ConversationToken::issue(assistantConversationFor($this->admin)->id));

    $this->withHeaders($headers + ['X-Tenant' => 'company'])
        ->postJson('/api/v1/assistant/tools/ticket_create', [
            'desk_id' => assistantIncidentDeskId(),
            'summary' => 'Tenant from token',
        ])
        ->assertStatus(202);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(AssistantPendingAction::query()->where('summary', 'like', '%Tenant from token%')->exists())->toBeTrue();
    Tenancy::end();
});

test('a write tool proposes an action and does not create the ticket until it is confirmed', function () {
    $before = assistantTicketCount();

    $pendingId = assistantProposeTicket($this, $this->admin, 'VPN down');

    expect(assistantTicketCount())->toBe($before);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $action = AssistantPendingAction::query()->whereKey($pendingId)->firstOrFail();
    expect($action->status)->toBe(AssistantPendingActionStatus::Pending)
        ->and($action->user_id)->toBe($this->admin->id)
        ->and($action->tool)->toBe('ticket_create');
    Tenancy::end();
});

test('a confirmed write creates the ticket once and records the audit trail', function () {
    $before = assistantTicketCount();
    $pendingId = assistantProposeTicket($this, $this->admin, 'VPN down');

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/confirm")
        ->assertOk()
        ->assertJsonPath('status', 'confirmed')
        ->assertJsonPath('data.summary', 'VPN down');

    expect(assistantTicketCount())->toBe($before + 1);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(AssistantPendingAction::query()->whereKey($pendingId)->firstOrFail()->status)
        ->toBe(AssistantPendingActionStatus::Confirmed);
    expect(Activity::query()->where('event', 'pending_proposed')->exists())->toBeTrue()
        ->and(Activity::query()->where('event', 'pending_confirmed')->exists())->toBeTrue();
    Tenancy::end();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/confirm")
        ->assertStatus(409);

    expect(assistantTicketCount())->toBe($before + 1);
});

test('the agent connector cannot confirm a pending action', function () {
    $before = assistantTicketCount();
    $pendingId = assistantProposeTicket($this, $this->admin, 'VPN down');
    $headers = assistantConnectorHeaders(ConversationToken::issue(assistantConversationFor($this->admin)->id));

    $this->withHeaders($headers)
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/confirm")
        ->assertUnauthorized();

    expect(assistantTicketCount())->toBe($before);
});

test('another member cannot confirm or cancel a pending action', function () {
    $pendingId = assistantProposeTicket($this, $this->admin, 'VPN down');
    $learner = assistantLearner();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/confirm")
        ->assertNotFound();

    $this->actingAs($learner)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/cancel")
        ->assertNotFound();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(AssistantPendingAction::query()->whereKey($pendingId)->firstOrFail()->status)
        ->toBe(AssistantPendingActionStatus::Pending);
    Tenancy::end();
});

test('a cancelled pending action cannot be confirmed later', function () {
    $before = assistantTicketCount();
    $pendingId = assistantProposeTicket($this, $this->admin, 'VPN down');

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/cancel")
        ->assertOk()
        ->assertJsonPath('status', 'cancelled');

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/confirm")
        ->assertStatus(409);

    expect(assistantTicketCount())->toBe($before);
});

test('an expired pending action cannot be confirmed', function () {
    $before = assistantTicketCount();
    $pendingId = assistantProposeTicket($this, $this->admin, 'VPN down');

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    AssistantPendingAction::query()->whereKey($pendingId)->update(['expires_at' => now()->subMinute()]);
    Tenancy::end();

    $this->actingAs($this->admin)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/confirm")
        ->assertStatus(409);

    expect(assistantTicketCount())->toBe($before);
});

test('a user who lost the permission cannot confirm an earlier proposal', function () {
    $before = assistantTicketCount();
    $pendingId = assistantProposeTicket($this, $this->admin, 'VPN down');

    setPermissionsTeamId('itneck');
    $this->admin->syncRoles([]);
    setPermissionsTeamId(null);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->actingAs(User::query()->findOrFail($this->admin->id))
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/assistant/pending-actions/{$pendingId}/confirm")
        ->assertForbidden();

    expect(assistantTicketCount())->toBe($before);

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(AssistantPendingAction::query()->whereKey($pendingId)->firstOrFail()->status)
        ->toBe(AssistantPendingActionStatus::Failed);
    Tenancy::end();
});
