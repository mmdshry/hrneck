<?php

use App\Domains\Subscriptions\Actions\AssignTenantSubscription;
use App\Domains\Subscriptions\Actions\SaveSubscriptionPlan;
use App\Domains\Subscriptions\Exceptions\PlanLimitReached;
use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Models\TenantSubscription;
use App\Domains\Subscriptions\Support\PlanFeature;
use App\Domains\Subscriptions\Support\SubscriptionStatus;
use App\Domains\Subscriptions\Support\TenantEntitlements;
use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Resources\SubscriptionPlans\Pages\ManageSubscriptionPlans;
use App\Filament\Resources\Tenants\Pages\ManageTenants;
use App\Models\Tenant;
use Carbon\CarbonInterface;
use Filament\Facades\Filament;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Spatie\Activitylog\Models\Activity;
use Stancl\Tenancy\Facades\Tenancy;

/**
 * Points the seeded "itneck" organization at a plan, creating or replacing its subscription row.
 */
function setItneckSubscription(
    SubscriptionPlan $plan,
    SubscriptionStatus $status = SubscriptionStatus::Active,
    ?CarbonInterface $date = null,
): void {
    TenantSubscription::query()->updateOrCreate(
        ['tenant_id' => 'itneck'],
        [
            'subscription_plan_id' => $plan->getKey(),
            'status' => $status,
            'starts_at' => now(),
            'trial_ends_at' => $status === SubscriptionStatus::Trial ? $date : null,
            'ends_at' => $status === SubscriptionStatus::Active ? $date : null,
        ],
    );
}

function itneckEmployeeUsage(): int
{
    return app(TenantEntitlements::class)->usage('itneck')['employees'];
}

test('tenants without a subscription row fall back to the default plan limits', function () {
    TenantSubscription::query()->where('tenant_id', 'itneck')->delete();
    SubscriptionPlan::query()->where('is_default', true)->update(['max_employees' => 0]);

    expect(fn () => app(TenantEntitlements::class)->assertCanCreateTargets('itneck'))
        ->toThrow(PlanLimitReached::class);
});

test('tenants are unrestricted when no default plan exists', function () {
    TenantSubscription::query()->where('tenant_id', 'itneck')->delete();
    SubscriptionPlan::query()->update(['is_default' => false]);

    $entitlements = app(TenantEntitlements::class);

    expect($entitlements->hasFeature('itneck', PlanFeature::Ticketing))->toBeTrue();
    $entitlements->assertCanCreateTargets('itneck', 1000);
});

test('assigning the default plan is idempotent for a tenant', function () {
    TenantSubscription::query()->where('tenant_id', 'company')->delete();

    $entitlements = app(TenantEntitlements::class);
    $entitlements->assignDefaultPlan('company');
    $entitlements->assignDefaultPlan('company');

    $defaultPlan = SubscriptionPlan::query()->where('is_default', true)->firstOrFail();
    $rows = TenantSubscription::query()->where('tenant_id', 'company')->get();

    expect($rows)->toHaveCount(1)
        ->and($rows->first()->subscription_plan_id)->toBe($defaultPlan->id)
        ->and($rows->first()->status)->toBe(SubscriptionStatus::Active);
});

test('employee limit blocks creating a target through the org API without creating a row', function () {
    $before = itneckEmployeeUsage();
    setItneckSubscription(SubscriptionPlan::factory()->limited($before, null)->create());

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->postJson('/api/v1/org/targets', [
            'email' => 'blocked.'.Str::lower(Str::random(8)).'@example.test',
            'first_name' => 'Blocked',
            'last_name' => 'Target',
        ])
        ->assertForbidden()
        ->assertJsonPath('code', 'plan_limit_reached');

    expect(itneckEmployeeUsage())->toBe($before);
});

test('a disabled feature is blocked by the API with plan_feature_disabled', function () {
    setItneckSubscription(SubscriptionPlan::factory()->withFeatures([PlanFeature::Ticketing->value => false])->create());

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/ticketing/tickets')
        ->assertForbidden()
        ->assertJsonPath('code', 'plan_feature_disabled');

    setItneckSubscription(SubscriptionPlan::factory()->create());

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/ticketing/tickets')
        ->assertOk();
});

test('read-only subscriptions keep reads working but block every org write', function (SubscriptionStatus $status) {
    setItneckSubscription(SubscriptionPlan::factory()->create(), $status);

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/targets')
        ->assertOk();

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/ticketing/tickets')
        ->assertOk();

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->postJson('/api/v1/org/targets', [
            'email' => 'readonly.'.Str::lower(Str::random(8)).'@example.test',
            'first_name' => 'Read',
            'last_name' => 'Only',
        ])
        ->assertForbidden()
        ->assertJsonPath('code', 'subscription_read_only')
        ->assertJsonPath('status', $status->value);

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->putJson('/api/v1/org/domains', ['sending_domain' => 'mail.itneck.test'])
        ->assertForbidden()
        ->assertJsonPath('code', 'subscription_read_only');
})->with([SubscriptionStatus::Suspended, SubscriptionStatus::Expired]);

test('a trial whose end date has passed becomes read-only and reads as expired', function () {
    setItneckSubscription(SubscriptionPlan::factory()->create(), SubscriptionStatus::Trial, now()->subDay());

    $entitlements = app(TenantEntitlements::class);

    expect($entitlements->readOnlyStatus('itneck'))->toBe(SubscriptionStatus::Expired)
        ->and($entitlements->hasFeature('itneck', PlanFeature::Ticketing))->toBeTrue();
    expect(fn () => $entitlements->assertCanCreateTargets('itneck'))
        ->toThrow(PlanLimitReached::class);
});

test('the trial expiry command expires only lapsed trials and audits each one', function () {
    $lapsed = TenantSubscription::query()->updateOrCreate(['tenant_id' => 'itneck'], [
        'subscription_plan_id' => SubscriptionPlan::factory()->create()->id,
        'status' => SubscriptionStatus::Trial,
        'starts_at' => now()->subDays(30),
        'trial_ends_at' => now()->subHour(),
        'ends_at' => null,
    ]);
    $ongoing = TenantSubscription::query()->updateOrCreate(['tenant_id' => 'company'], [
        'subscription_plan_id' => SubscriptionPlan::factory()->create()->id,
        'status' => SubscriptionStatus::Trial,
        'starts_at' => now()->subDays(3),
        'trial_ends_at' => now()->addDays(3),
        'ends_at' => null,
    ]);
    $active = TenantSubscription::query()->updateOrCreate(['tenant_id' => 'test'], [
        'subscription_plan_id' => SubscriptionPlan::factory()->create()->id,
        'status' => SubscriptionStatus::Active,
        'starts_at' => now()->subDays(3),
        'trial_ends_at' => null,
        'ends_at' => null,
    ]);

    $this->artisan('hrneck:expire-trial-subscriptions')->assertSuccessful();

    expect($lapsed->fresh()->status)->toBe(SubscriptionStatus::Expired)
        ->and($ongoing->fresh()->status)->toBe(SubscriptionStatus::Trial)
        ->and($active->fresh()->status)->toBe(SubscriptionStatus::Active);

    expect(Activity::query()
        ->where('event', 'tenant_subscription_expired')
        ->where('subject_type', TenantSubscription::class)
        ->where('subject_id', $lapsed->id)
        ->exists())->toBeTrue();
});

test('a manually reactivated subscription is writable again after the trial job has run', function () {
    setItneckSubscription(SubscriptionPlan::factory()->create(), SubscriptionStatus::Trial, now()->subDay());
    $this->artisan('hrneck:expire-trial-subscriptions')->assertSuccessful();

    setItneckSubscription(SubscriptionPlan::factory()->create(), SubscriptionStatus::Active, now()->addMonth());

    expect(app(TenantEntitlements::class)->readOnlyStatus('itneck'))->toBeNull();
});

test('auth me reports the plan, status and usage against limits for the active organization', function () {
    $used = itneckEmployeeUsage();
    $plan = SubscriptionPlan::factory()->limited(max(0, $used - 1), null)->create(['name' => 'Growth plan']);
    setItneckSubscription($plan);

    $this->actingAs(orgAdmin())
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.tenant_id', 'itneck')
        ->assertJsonPath('data.subscription.plan_name', 'Growth plan')
        ->assertJsonPath('data.subscription.status', 'active')
        ->assertJsonPath('data.subscription.read_only', false)
        ->assertJsonPath('data.subscription.usage.employees.used', $used)
        ->assertJsonPath('data.subscription.usage.employees.limit', max(0, $used - 1))
        ->assertJsonPath('data.subscription.usage.employees.over_limit', $used > 0)
        ->assertJsonPath('data.subscription.usage.users.limit', null)
        ->assertJsonPath('data.subscription.over_limit', $used > 0);
});

test('auth me shows a lapsed trial as expired and read-only', function () {
    setItneckSubscription(SubscriptionPlan::factory()->create(), SubscriptionStatus::Trial, now()->subDay());

    $this->actingAs(orgAdmin())
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.subscription.status', 'trial')
        ->assertJsonPath('data.subscription.effective_status', 'expired')
        ->assertJsonPath('data.subscription.read_only', true);
});

test('custom domains reflect the plan and block updates when disabled', function () {
    setItneckSubscription(SubscriptionPlan::factory()->withFeatures([PlanFeature::CustomDomains->value => false])->create());

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/domains')
        ->assertOk()
        ->assertJsonPath('data.enabled', false);

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->putJson('/api/v1/org/domains', ['sending_domain' => 'mail.itneck.test'])
        ->assertForbidden()
        ->assertJsonPath('code', 'plan_feature_disabled');

    setItneckSubscription(SubscriptionPlan::factory()->create());

    $this->actingAs(orgAdmin())
        ->withHeaders(['X-Tenant' => 'itneck'])
        ->getJson('/api/v1/org/domains')
        ->assertOk()
        ->assertJsonPath('data.enabled', true);
});

test('only platform staff can open the subscription plans admin page', function () {
    $this->actingAs(platformAdmin())
        ->get('/admin/subscription-plans')
        ->assertOk();

    $this->actingAs(orgAdmin())
        ->get('/admin/subscription-plans')
        ->assertForbidden();
});

test('saving a new default plan moves the flag and the current default cannot be unset', function () {
    $saved = app(SaveSubscriptionPlan::class)->handle([
        'name' => 'Enterprise',
        'slug' => 'enterprise-'.Str::lower(Str::random(6)),
        'is_active' => true,
        'is_default' => true,
        'features' => [PlanFeature::Ticketing->value => true],
    ]);

    expect($saved->fresh()->is_default)->toBeTrue()
        ->and(SubscriptionPlan::query()->where('is_default', true)->count())->toBe(1)
        ->and($saved->includesFeature(PlanFeature::Training))->toBeFalse();

    expect(fn () => app(SaveSubscriptionPlan::class)->handle([
        'name' => $saved->name,
        'slug' => $saved->slug,
        'is_active' => true,
        'is_default' => false,
        'features' => [],
    ], $saved->fresh()))->toThrow(ValidationException::class);
});

test('the default plan must be active', function () {
    expect(fn () => app(SaveSubscriptionPlan::class)->handle([
        'name' => 'Inactive default',
        'slug' => 'inactive-default-'.Str::lower(Str::random(6)),
        'is_active' => false,
        'is_default' => true,
        'features' => [],
    ]))->toThrow(ValidationException::class);
});

test('a trial requires an end date when assigned', function () {
    expect(fn () => app(AssignTenantSubscription::class)->handle('itneck', [
        'subscription_plan_id' => SubscriptionPlan::factory()->create()->id,
        'status' => SubscriptionStatus::Trial->value,
        'trial_ends_at' => null,
        'ends_at' => null,
    ]))->toThrow(ValidationException::class);
});

test('changing the plan restarts the subscription start date but keeping the plan does not', function () {
    TenantSubscription::query()->where('tenant_id', 'itneck')->delete();
    $plan = SubscriptionPlan::factory()->create();
    $other = SubscriptionPlan::factory()->create();

    $data = ['status' => SubscriptionStatus::Active->value, 'trial_ends_at' => null, 'ends_at' => null];

    $subscription = app(AssignTenantSubscription::class)->handle('itneck', $data + ['subscription_plan_id' => $plan->id]);
    $subscription->forceFill(['starts_at' => now()->subDays(10)])->save();

    $kept = app(AssignTenantSubscription::class)->handle('itneck', $data + ['subscription_plan_id' => $plan->id]);
    expect($kept->starts_at->toDateString())->toBe(now()->subDays(10)->toDateString());

    $moved = app(AssignTenantSubscription::class)->handle('itneck', $data + ['subscription_plan_id' => $other->id]);
    expect($moved->starts_at->isToday())->toBeTrue()
        ->and(TenantSubscription::query()->where('tenant_id', 'itneck')->count())->toBe(1);
});

test('only new emails consume employee seats', function () {
    $entitlements = app(TenantEntitlements::class);
    setItneckSubscription(SubscriptionPlan::factory()->limited(itneckEmployeeUsage(), null)->create());

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    $existing = Target::query()->where('status', 'active')->value('email');
    Tenancy::end();

    expect($existing)->not->toBeNull();

    $entitlements->assertCanCreateTargetsForEmails('itneck', [$existing]);
    $entitlements->assertCanGrantEmployeeTarget('itneck', $existing, null);

    expect(fn () => $entitlements->assertCanCreateTargetsForEmails('itneck', ['new.'.Str::lower(Str::random(8)).'@example.test']))
        ->toThrow(PlanLimitReached::class);
});

test('platform staff can assign a plan and status to an organization from Filament', function () {
    Filament::setCurrentPanel(Filament::getPanel('admin'));
    $plan = SubscriptionPlan::factory()->create();

    Livewire::actingAs(platformAdmin())
        ->test(ManageTenants::class)
        ->callTableAction('changePlan', Tenant::query()->findOrFail('itneck'), data: [
            'subscription_plan_id' => $plan->id,
            'status' => SubscriptionStatus::Suspended->value,
        ])
        ->assertHasNoTableActionErrors();

    $subscription = TenantSubscription::query()->where('tenant_id', 'itneck')->firstOrFail();

    expect($subscription->subscription_plan_id)->toBe($plan->id)
        ->and($subscription->status)->toBe(SubscriptionStatus::Suspended);
});

test('platform staff can create a subscription plan from Filament', function () {
    Filament::setCurrentPanel(Filament::getPanel('admin'));
    $slug = 'growth-'.Str::lower(Str::random(6));

    Livewire::actingAs(platformAdmin())
        ->test(ManageSubscriptionPlans::class)
        ->callAction('create', data: [
            'name' => 'Growth',
            'slug' => $slug,
            'sort_order' => 2,
            'is_active' => true,
            'is_default' => false,
            'max_employees' => 50,
            'max_users' => null,
            'features' => [PlanFeature::Ticketing->value => true],
        ])
        ->assertHasNoActionErrors();

    $plan = SubscriptionPlan::query()->where('slug', $slug)->firstOrFail();

    expect($plan->max_employees)->toBe(50)
        ->and($plan->max_users)->toBeNull()
        ->and($plan->includesFeature(PlanFeature::Ticketing))->toBeTrue()
        ->and($plan->includesFeature(PlanFeature::Training))->toBeFalse();
});
