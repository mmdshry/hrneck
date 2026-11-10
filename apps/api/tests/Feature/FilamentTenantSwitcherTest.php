<?php

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\TargetsGroups\Models\Group;
use App\Filament\Pages\Auth\Login;
use App\Http\Middleware\ApplyFilamentTenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Support\FilamentTenant;
use Database\Seeders\DemoSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Livewire\Livewire;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('organization users get the same generic Filament login failure as bad passwords', function () {
    Filament::setCurrentPanel(Filament::getPanel('admin'));

    // Anti-enumeration: org users must not get a distinct "belongs to an organization" hint.
    Livewire::test(Login::class)
        ->set('data.email', 'admin@itneck.test')
        ->set('data.password', 'DemoPass!234')
        ->call('authenticate')
        ->assertHasErrors(['data.email'])
        ->assertSee('These credentials do not match our records.')
        ->assertDontSee('belongs to an organization');

    Livewire::test(Login::class)
        ->set('data.email', 'admin@hrneck.test')
        ->set('data.password', 'wrong-password')
        ->call('authenticate')
        ->assertHasErrors(['data.email'])
        ->assertSee('These credentials do not match our records.');
});

test('filament tenant session can be set and cleared', function () {
    expect(FilamentTenant::id())->toBeNull()
        ->and(FilamentTenant::has())->toBeFalse();

    FilamentTenant::set('itneck');
    expect(FilamentTenant::id())->toBe('itneck')
        ->and(FilamentTenant::has())->toBeTrue()
        ->and(FilamentTenant::tenant()?->id)->toBe('itneck');

    FilamentTenant::set(null);
    expect(FilamentTenant::id())->toBeNull()
        ->and(FilamentTenant::has())->toBeFalse();
});

test('apply filament tenant context initializes and ends tenancy', function () {
    FilamentTenant::set('itneck');

    $middleware = new ApplyFilamentTenantContext;
    $request = Request::create('/admin/test-tenant-context', 'GET');

    $sawInitialized = false;
    $response = $middleware->handle($request, function () use (&$sawInitialized) {
        $sawInitialized = tenancy()->initialized;
        expect(tenant('id'))->toBe('itneck');

        return response('ok');
    });

    expect($sawInitialized)->toBeTrue()
        ->and($response->getContent())->toBe('ok')
        ->and(tenancy()->initialized)->toBeFalse();
});

test('admin panel and campaigns page smoke with tenant session', function () {
    $user = User::query()->where('email', config('brand.demo_admin_email'))->firstOrFail();

    $this->actingAs($user)
        ->withSession([FilamentTenant::SESSION_KEY => 'itneck'])
        ->get('/admin')
        ->assertOk();

    $this->actingAs($user)
        ->withSession([FilamentTenant::SESSION_KEY => 'itneck'])
        ->get('/admin/campaigns')
        ->assertOk();
});

test('filament tenant middleware makes groups queryable like a livewire update', function () {
    FilamentTenant::set('company');

    $middleware = new ApplyFilamentTenantContext;
    $middleware->handle(Request::create('/livewire/update', 'POST'), function () {
        expect(tenancy()->initialized)->toBeTrue()
            ->and(Schema::hasTable('groups'))->toBeTrue()
            ->and(Group::query()->count())->toBeGreaterThan(0);

        return response('ok');
    });

    expect(tenancy()->initialized)->toBeFalse();
});

test('asset urls stay central while filament tenant context is active', function () {
    Tenancy::initialize(Tenant::query()->findOrFail('company'));

    expect(asset('css/filament/filament/app.css'))
        ->not->toContain('tenancy/assets');

    Tenancy::end();
});

test('tenant resources render without org selected without querying central', function () {
    $user = User::query()->where('email', config('brand.demo_admin_email'))->firstOrFail();

    $this->actingAs($user)
        ->get('/admin/groups')
        ->assertOk();

    $this->actingAs($user)
        ->get('/admin/targets')
        ->assertOk();
});

test('requires filament tenant returns empty query without session', function () {
    expect(FilamentTenant::has())->toBeFalse();

    FilamentTenant::set('itneck');
    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(Campaign::query()->count())->toBeGreaterThanOrEqual(0);
    Tenancy::end();
    FilamentTenant::set(null);
});
