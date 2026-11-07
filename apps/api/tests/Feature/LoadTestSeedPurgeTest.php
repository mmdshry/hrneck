<?php

use App\Models\Tenant;
use App\Support\LoadTestMarkers;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\DemoSeeder::class);
});

test('load test seed and purge round-trip with small scale', function () {
    Artisan::call('hrneck:purge-load-test', ['--force' => true]);

    Artisan::call('hrneck:seed-load-test', [
        '--orgs' => 1,
        '--per-org' => 5,
        '--itneck-targets' => 10,
        '--chunk' => 5,
    ]);

    $slug = LoadTestMarkers::tenantId(1);
    expect(Tenant::query()->whereKey($slug)->exists())->toBeTrue();

    Tenancy::initialize(Tenant::query()->findOrFail($slug));
    expect(DB::table('targets')->where('external_id', 'like', 'loadtest:%')->count())->toBe(5);
    expect(DB::table('groups')->where('source', 'loadtest')->count())->toBeGreaterThan(0);
    Tenancy::end();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(DB::table('targets')->where('email', 'like', '%@loadtest.example')->count())->toBe(10);
    Tenancy::end();

    Artisan::call('hrneck:purge-load-test', ['--force' => true]);

    expect(Tenant::query()->whereKey($slug)->exists())->toBeFalse();

    Tenancy::initialize(Tenant::query()->findOrFail('itneck'));
    expect(DB::table('targets')->where('email', 'like', '%@loadtest.example')->count())->toBe(0);
    expect(DB::table('groups')->where('source', 'loadtest')->count())->toBe(0);
    Tenancy::end();

    expect(Tenant::query()->whereKey('itneck')->exists())->toBeTrue();
});
