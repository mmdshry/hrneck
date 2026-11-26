<?php

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Support\PlanFeature;
use App\Models\User;
use Illuminate\Support\Str;

function kbTestMember(array $permissions): User
{
    $suffix = Str::lower(Str::random(8));

    return rbacMemberWith('kb.'.$suffix.'@itneck.test', 'kb_'.$suffix, $permissions);
}

test('view-only knowledge base users can read but not write articles', function () {
    $viewer = kbTestMember([OrgPermissionCatalog::KB_VIEW]);

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/kb')
        ->assertOk();

    $this->actingAs($viewer)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/kb', ['summary' => 'Viewer draft'])
        ->assertForbidden();
});

test('knowledge base managers can create and publish articles', function () {
    $manager = kbTestMember([OrgPermissionCatalog::KB_VIEW, OrgPermissionCatalog::KB_MANAGE]);

    $this->actingAs($manager)
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/kb', [
            'summary' => 'Manager article '.Str::lower(Str::random(6)),
            'is_published' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.is_published', true);
});

test('ticketing access alone does not open the knowledge base', function () {
    $agent = kbTestMember([OrgPermissionCatalog::TICKETING_TICKETS]);

    $this->actingAs($agent)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/kb')
        ->assertForbidden();
});

test('knowledge base access alone does not open ticketing', function () {
    $reader = kbTestMember([OrgPermissionCatalog::KB_VIEW, OrgPermissionCatalog::KB_MANAGE]);

    $this->actingAs($reader)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/tickets')
        ->assertForbidden();
});

test('a plan without the knowledge base feature blocks the knowledge base API', function () {
    setItneckSubscription(SubscriptionPlan::factory()->withFeatures([PlanFeature::KnowledgeBase->value => false])->create());

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/ticketing/kb')
        ->assertForbidden()
        ->assertJsonPath('code', 'plan_feature_disabled');

    setItneckSubscription(SubscriptionPlan::factory()->create());

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/ticketing/kb')
        ->assertOk();
});

test('search returns knowledge base hits only to users who can view the knowledge base', function () {
    $token = 'KbGate'.Str::lower(Str::random(10));

    $this->actingAs(orgAdmin())
        ->withHeader('X-Tenant', 'itneck')
        ->postJson('/api/v1/org/ticketing/kb', [
            'summary' => 'Article '.$token,
            'is_published' => true,
        ])
        ->assertCreated();

    $agent = kbTestMember([OrgPermissionCatalog::TICKETING_TICKETS]);
    $reader = kbTestMember([OrgPermissionCatalog::TICKETING_TICKETS, OrgPermissionCatalog::KB_VIEW]);

    $this->actingAs($agent)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/search?q='.$token)
        ->assertOk()
        ->assertJsonCount(0, 'data.kb');

    $this->actingAs($reader)
        ->withHeader('X-Tenant', 'itneck')
        ->getJson('/api/v1/org/ticketing/search?q='.$token)
        ->assertOk()
        ->assertJsonCount(1, 'data.kb');
});
