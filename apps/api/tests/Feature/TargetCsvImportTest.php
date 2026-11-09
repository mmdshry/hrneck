<?php

use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('csv import upserts targets in tenant', function () {
    $user = orgAdmin();

    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);

    $csv = "email,first_name,last_name,department\ncsv.user@example.test,Csv,User,IT\n";
    $file = UploadedFile::fake()->createWithContent('targets.csv', $csv);

    $this->actingAs($user)
        ->withHeader('X-Tenant', 'itneck')
        ->post('/api/v1/org/targets/import', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('imported', 1);

    expect(Target::query()->where('email', 'csv.user@example.test')->exists())->toBeTrue();

    Tenancy::end();
});
