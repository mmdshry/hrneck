<?php

use App\Domains\Ticketing\Actions\CreateTicket;
use App\Domains\Ticketing\Actions\UpdateTicket;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdStage;
use App\Models\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stancl\Tenancy\Facades\Tenancy;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DemoSeeder::class);
});

test('moving ticket to resolved stage sets resolved_at', function () {
    $tenant = Tenant::query()->findOrFail('itneck');
    Tenancy::initialize($tenant);

    $desk = SdDesk::query()->where('slug', 'incident')->firstOrFail();
    $resolved = SdStage::query()
        ->where('desk_id', $desk->id)
        ->where('name', 'Resolved')
        ->firstOrFail();

    expect($resolved->is_terminal)->toBeTrue();

    $ticket = app(CreateTicket::class)->handle([
        'desk_id' => $desk->id,
        'summary' => 'Resolve me',
    ], orgAdmin()->id);

    expect($ticket->resolved_at)->toBeNull();

    app(UpdateTicket::class)->handle($ticket, [
        'stage_id' => $resolved->id,
    ], orgAdmin()->id);

    expect($ticket->fresh()->resolved_at)->not->toBeNull();
    Tenancy::end();
});
