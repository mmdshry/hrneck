<?php

namespace App\Models;

use Spatie\Permission\Models\Permission as SpatiePermission;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Permission extends SpatiePermission
{
    use CentralConnection;
}
