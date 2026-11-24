<?php

use App\Domains\Tenancy\Actions\DeprovisionLoadTestTenant;
use App\Domains\Tenancy\Actions\ProvisionTenant;
use App\Models\Tenant;
use App\Support\LoadTestMarkers;
use Illuminate\Support\Facades\DB;
use Tests\Support\TestingTenancyState;

test('provision tenant creates database domain and sample content', function () {
    $slug = 'prov-'.substr(uniqid(), -6);

    TestingTenancyState::markDirty();

    $tenant = app(ProvisionTenant::class)->handle([
        'slug' => $slug,
        'name' => 'Provisioned Org',
        'industry' => 'Technology',
        'employee_band' => '11-50',
    ]);

    expect($tenant->id)->toBe($slug)
        ->and($tenant->name)->toBe('Provisioned Org')
        ->and($tenant->domains)->not->toBeEmpty();

    $dbName = (string) config('tenancy.database.prefix').$slug;
    expect(DB::select("SHOW DATABASES LIKE '{$dbName}'"))->not->toBeEmpty();

    // cleanup
    DB::statement("DROP DATABASE IF EXISTS `{$dbName}`");
    DB::table('domains')->where('tenant_id', $slug)->delete();
    DB::table('tenants')->where('id', $slug)->delete();
});

test('deprovision only allows loadtest tenants', function () {
    $itneck = Tenant::query()->findOrFail('itneck');

    expect(fn () => app(DeprovisionLoadTestTenant::class)->handle($itneck))
        ->toThrow(InvalidArgumentException::class);

    $slug = LoadTestMarkers::tenantId(99);
    TestingTenancyState::markDirty();
    app(ProvisionTenant::class)->handle([
        'slug' => $slug,
        'name' => 'Temp Load',
    ]);

    app(DeprovisionLoadTestTenant::class)->handle(Tenant::query()->findOrFail($slug));

    expect(Tenant::query()->whereKey($slug)->exists())->toBeFalse();
});

test('filament admin login page is reachable', function () {
    $this->get('/admin/login')->assertOk();
});
