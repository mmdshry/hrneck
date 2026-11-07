<?php

use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Ticketing\Actions\ApplySlaGoals;
use App\Domains\Ticketing\Actions\ProcessEscalations;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdEmailReader;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdTicket;
use App\Models\Role;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\DemoSeeder::class);
    $this->user = orgAdmin();
    $this->tenant = Tenant::query()->findOrFail('itneck');
});

function asTicketingAdmin($test): mixed
{
    return $test->actingAs($test->user)->withHeader('X-Tenant', 'itneck');
}

test('itil desks and sample kb are seeded', function () {
    Tenancy::initialize($this->tenant);
    expect(SdDesk::query()->where('is_system', true)->count())->toBeGreaterThanOrEqual(5);
    expect(SdDesk::query()->where('slug', 'incident')->exists())->toBeTrue();
    expect(SdKbArticle::query()->where('is_published', true)->exists())->toBeTrue();
    Tenancy::end();
});

test('ticket lifecycle notes tasks lock archive merge copy convert kb', function () {
    Tenancy::initialize($this->tenant);
    $desk = SdDesk::query()->where('slug', 'incident')->firstOrFail();
    $deskId = $desk->id;
    Tenancy::end();

    $created = asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'VPN down',
            'description' => 'Cannot connect',
        ])
        ->assertCreated()
        ->json('data');

    expect($created['number'])->toStartWith('INC-')
        ->and($created['assignee_pool'])->toBe('tier1');

    $id = $created['id'];

    $publicNote = asTicketingAdmin($this)
        ->postJson("/api/v1/org/ticketing/tickets/{$id}/notes", [
            'body' => 'Working on it',
            'is_public' => true,
        ])
        ->assertCreated()
        ->json('data');

    expect($publicNote['is_public'])->toBeTrue();

    $privateByDefault = asTicketingAdmin($this)
        ->postJson("/api/v1/org/ticketing/tickets/{$id}/notes", [
            'body' => 'Internal only',
        ])
        ->assertCreated()
        ->json('data');

    expect($privateByDefault['is_public'])->toBeFalse();

    asTicketingAdmin($this)
        ->postJson("/api/v1/org/ticketing/tickets/{$id}/tasks", [
            'title' => 'Restart concentrator',
            'hours_worked' => 0.5,
        ])
        ->assertCreated();

    $second = asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'Related VPN',
        ])
        ->assertCreated()
        ->json('data');

    asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets/bulk', [
            'action' => 'link',
            'ids' => [$id, $second['id']],
        ])
        ->assertOk();

    $copy = asTicketingAdmin($this)
        ->postJson("/api/v1/org/ticketing/tickets/{$id}/copy", [
            'desk_id' => $deskId,
            'include_notes' => true,
        ])
        ->assertCreated()
        ->json('data');

    expect($copy['id'])->not->toBe($id);

    asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets/bulk', [
            'action' => 'merge',
            'ids' => [$id, $second['id']],
            'primary_id' => $id,
        ])
        ->assertOk();

    $kb = asTicketingAdmin($this)
        ->postJson("/api/v1/org/ticketing/tickets/{$id}/convert-kb", [
            'publish' => true,
        ])
        ->assertCreated()
        ->json('data');

    expect($kb['is_published'])->toBeTrue();

    asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets/bulk', [
            'action' => 'archive',
            'ids' => [$copy['id']],
        ])
        ->assertOk();

    asTicketingAdmin($this)
        ->getJson('/api/v1/org/ticketing/tickets?archived=1')
        ->assertOk()
        ->assertJsonFragment(['id' => $copy['id']]);
});

test('escalation and sla breach processing', function () {
    Tenancy::initialize($this->tenant);
    $desk = SdDesk::query()->where('slug', 'incident')->firstOrFail();
    Tenancy::end();

    $ticket = asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $desk->id,
            'summary' => 'Escalate me',
        ])
        ->assertCreated()
        ->json('data');

    Tenancy::initialize($this->tenant);
    $model = SdTicket::query()->findOrFail($ticket['id']);
    $model->escalation_due_at = Carbon::now()->subMinute();
    $model->sla_response_due_at = Carbon::now()->subMinute();
    $model->first_responded_at = null;
    $model->sla_response_breached = false;
    $model->save();
    $levelBefore = (int) $model->escalation_level;

    app(ProcessEscalations::class)->handle();
    app(ApplySlaGoals::class)->evaluateBreaches();

    $model->refresh();
    expect($model->escalation_level)->toBe($levelBefore + 1)
        ->and($model->sla_response_breached)->toBeTrue()
        ->and($model->assignee_pool)->toBe('tier2');
    Tenancy::end();
});

test('email ingest creates ticket and threads reply by number', function () {
    Tenancy::initialize($this->tenant);
    $desk = SdDesk::query()->where('slug', 'incident')->firstOrFail();
    $reader = SdEmailReader::query()->create([
        'name' => 'Support inbox',
        'desk_id' => $desk->id,
        'host' => '127.0.0.1',
        'port' => 993,
        'encryption' => 'ssl',
        'username' => 'support@example.com',
        'password' => 'secret',
        'mailbox' => 'INBOX',
        'is_active' => true,
    ]);
    $readerId = $reader->id;
    Tenancy::end();

    $ticket = asTicketingAdmin($this)
        ->postJson("/api/v1/org/ticketing/email-readers/{$readerId}/ingest", [
            'from' => 'alice@example.com',
            'subject' => 'Laptop broken',
            'body' => 'Screen cracked',
        ])
        ->assertCreated()
        ->json('data');

    asTicketingAdmin($this)
        ->postJson("/api/v1/org/ticketing/email-readers/{$readerId}/ingest", [
            'from' => 'alice@example.com',
            'subject' => "Re: {$ticket['number']} Laptop broken",
            'body' => 'Still broken',
        ])
        ->assertCreated();

    asTicketingAdmin($this)
        ->getJson("/api/v1/org/ticketing/tickets/{$ticket['id']}")
        ->assertOk()
        ->assertJsonFragment(['body' => 'Still broken']);
});

test('import export round trip and reports', function () {
    Tenancy::initialize($this->tenant);
    $desk = SdDesk::query()->where('slug', 'incident')->firstOrFail();
    Tenancy::end();

    $ticket = asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $desk->id,
            'summary' => 'Export me',
        ])
        ->assertCreated()
        ->json('data');

    $exported = asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/export', ['ids' => [$ticket['id']]])
        ->assertOk()
        ->json('data');

    expect($exported['tickets'])->toHaveCount(1);

    asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/import', $exported)
        ->assertCreated();

    asTicketingAdmin($this)
        ->getJson('/api/v1/org/ticketing/reports/summary')
        ->assertOk()
        ->assertJsonPath('data.total_open', fn ($v) => $v >= 1);

    asTicketingAdmin($this)
        ->get('/api/v1/org/ticketing/reports/csv')
        ->assertOk();

    $pdfResponse = asTicketingAdmin($this)
        ->get('/api/v1/org/ticketing/reports/pdf')
        ->assertOk();

    expect($pdfResponse->headers->get('content-type'))->toContain('application/pdf');
    expect($pdfResponse->streamedContent())->toStartWith('%PDF');
});

test('portal user can create and note own ticket; permission matrix', function () {
    $portalUser = app(CreateOrgUser::class)->handle(
        'itneck',
        'Portal User',
        'portal@itneck.test',
        'DemoPass!234',
        [],
    );

    setPermissionsTeamId('itneck');
    $role = Role::create([
        'name' => 'portal_only',
        'guard_name' => OrgPermissionCatalog::GUARD,
        config('permission.column_names.team_foreign_key') => 'itneck',
    ]);
    $role->syncPermissions([OrgPermissionCatalog::TICKETING_PORTAL]);
    $portalUser->syncRoles([$role]);
    setPermissionsTeamId(null);

    $this->actingAs($portalUser)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets')
        ->assertForbidden();

    Tenancy::initialize($this->tenant);
    $deskId = SdDesk::query()->where('slug', 'incident')->value('id');
    Tenancy::end();

    $ticket = $this->actingAs($portalUser)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/portal/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'Need access',
            'description' => 'Badge not working',
        ])
        ->assertCreated()
        ->json('data');

    $this->actingAs($portalUser)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson("/api/v1/org/portal/ticketing/tickets/{$ticket['id']}/notes", [
            'body' => 'Any update?',
        ])
        ->assertCreated();

    $this->actingAs($portalUser)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/portal/ticketing/kb')
        ->assertOk();
});

test('search all finds tickets and kb', function () {
    Tenancy::initialize($this->tenant);
    $deskId = SdDesk::query()->where('slug', 'incident')->value('id');
    Tenancy::end();

    asTicketingAdmin($this)
        ->postJson('/api/v1/org/ticketing/tickets', [
            'desk_id' => $deskId,
            'summary' => 'UniqueZebraOutage',
        ])
        ->assertCreated();

    asTicketingAdmin($this)
        ->getJson('/api/v1/org/ticketing/search?q=UniqueZebraOutage')
        ->assertOk()
        ->assertJsonPath('data.tickets.0.summary', 'UniqueZebraOutage');

    asTicketingAdmin($this)
        ->getJson('/api/v1/org/ticketing/search?q=password')
        ->assertOk()
        ->assertJsonPath('data.kb.0.summary', fn ($s) => str_contains(strtolower((string) $s), 'password'));
});
