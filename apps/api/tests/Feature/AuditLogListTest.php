<?php

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\User;
use Stancl\Tenancy\Facades\Tenancy;

/**
 * Writes three audit entries whose events share a unique marker.
 * Descriptions deliberately omit the marker so only event-column matches can find them.
 */
function seedAuditListEntries(string $marker): void
{
    Tenancy::initialize('itneck');

    foreach (['alpha', 'beta', 'gamma'] as $suffix) {
        app(LogOrgActivity::class)->handle('audit_list_test', $marker.'-'.$suffix, 'Description '.$suffix);
    }

    Tenancy::end();
}

test('audit log search matches the event column as well as the description', function () {
    $admin = orgAdmin();
    $marker = 'auditlq'.uniqid();
    seedAuditListEntries($marker);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?q='.$marker.'-beta')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.event', $marker.'-beta');
});

test('audit log event filter matches partial event names', function () {
    $admin = orgAdmin();
    $marker = 'auditlq'.uniqid();
    seedAuditListEntries($marker);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker)
        ->assertOk()
        ->assertJsonCount(3, 'data');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker.'-gamma')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.event', $marker.'-gamma');
});

test('audit log sorts by whitelisted columns and ignores unknown sort keys', function () {
    $admin = orgAdmin();
    $marker = 'auditlq'.uniqid();
    seedAuditListEntries($marker);

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker.'&sort=event&order=desc')
        ->assertOk()
        ->assertJsonPath('data.0.event', $marker.'-gamma')
        ->assertJsonPath('data.2.event', $marker.'-alpha');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker.'&sort=event&order=asc')
        ->assertOk()
        ->assertJsonPath('data.0.event', $marker.'-alpha')
        ->assertJsonPath('data.2.event', $marker.'-gamma');

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker.'&sort=description&order=asc')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('audit log resolves actor and subject names and emails from live rows', function () {
    $admin = orgAdmin();
    $marker = 'auditlb'.uniqid();
    $email = $marker.'@example.test';

    Tenancy::initialize('itneck');
    $target = Target::query()->create([
        'email' => $email,
        'first_name' => 'Laleh',
        'last_name' => 'Ahmadi',
        'status' => 'active',
    ]);
    app(LogOrgActivity::class)->handle('audit_label_test', $marker, 'Target updated', $target, [], (int) $admin->id);
    Tenancy::end();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker)
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.causer.id', (int) $admin->id)
        ->assertJsonPath('data.0.causer.name', $admin->name)
        ->assertJsonPath('data.0.causer.email', $admin->email)
        ->assertJsonPath('data.0.subject.type', 'Target')
        ->assertJsonPath('data.0.subject.id', (int) $target->id)
        ->assertJsonPath('data.0.subject.label', 'Laleh Ahmadi')
        ->assertJsonPath('data.0.subject.email', $email);
});

test('audit log falls back to stored names when the actor and a deleted subject no longer exist', function () {
    $admin = orgAdmin();
    $marker = 'auditlb'.uniqid();
    $leaver = User::factory()->create(['name' => 'Leaving Person', 'email' => $marker.'@leaver.test']);

    Tenancy::initialize('itneck');
    app(LogOrgActivity::class)->handle('audit_label_test', $marker, 'Target deleted', null, [
        'target' => [
            'id' => 987654,
            'email' => 'gone@example.test',
            'first_name' => 'Reza',
            'last_name' => 'Karimi',
            'status' => 'active',
            'user_id' => null,
        ],
    ], (int) $leaver->id);
    Tenancy::end();

    $leaver->delete();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker)
        ->assertOk()
        ->assertJsonPath('data.0.causer.name', 'Leaving Person')
        ->assertJsonPath('data.0.causer.email', $marker.'@leaver.test')
        ->assertJsonPath('data.0.subject.type', 'Target')
        ->assertJsonPath('data.0.subject.id', 987654)
        ->assertJsonPath('data.0.subject.label', 'Reza Karimi')
        ->assertJsonPath('data.0.subject.email', 'gone@example.test');
});

test('audit log keeps the subject type and id when the row is gone and no snapshot exists', function () {
    $admin = orgAdmin();
    $marker = 'auditlb'.uniqid();

    Tenancy::initialize('itneck');
    $target = Target::query()->create([
        'email' => $marker.'@gone.test',
        'first_name' => 'Gone',
        'last_name' => 'Target',
        'status' => 'active',
    ]);
    app(LogOrgActivity::class)->handle('audit_label_test', $marker, 'Target updated', $target, []);
    $target->delete();
    Tenancy::end();

    $this->actingAs($admin)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/audit?event='.$marker)
        ->assertOk()
        ->assertJsonPath('data.0.causer', null)
        ->assertJsonPath('data.0.subject.type', 'Target')
        ->assertJsonPath('data.0.subject.id', (int) $target->id)
        ->assertJsonPath('data.0.subject.label', null)
        ->assertJsonPath('data.0.subject.email', null);
});
