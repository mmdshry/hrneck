<?php

namespace App\Filament\Resources\Pages;

use App\Filament\Concerns\InteractsWithFilamentTenantTable;
use Filament\Resources\Pages\ManageRecords;

abstract class ManageTenantRecords extends ManageRecords
{
    use InteractsWithFilamentTenantTable;
}
