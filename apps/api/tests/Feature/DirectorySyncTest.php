<?php

use App\Domains\DirectorySync\Actions\RunDirectorySync;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use Stancl\Tenancy\Facades\Tenancy;

test('mock directory sync imports fixture users', function () {
    $tenant = Tenant::query()->find('itneck') ?? Tenant::query()->create([
        'id' => 'itneck',
        'name' => 'ITneck',
    ]);

    Tenancy::initialize($tenant);

    $result = app(RunDirectorySync::class)->handle();

    expect($result['users'])->toBeGreaterThan(0)
        ->and(Target::query()->count())->toBeGreaterThan(0);

    Tenancy::end();
});
