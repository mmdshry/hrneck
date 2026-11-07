<?php

namespace App\Filament\Resources\Tickets\Pages;

use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Filament\Resources\Tickets\TicketResource;
use App\Support\FilamentTenant;

class ManageTickets extends ManageTenantRecords
{
    protected static string $resource = TicketResource::class;

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Tickets' : 'Tickets — select an organization';
    }
}
