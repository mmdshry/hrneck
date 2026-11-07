<?php

use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;
use App\Providers\HorizonServiceProvider;
use App\Providers\TelescopeServiceProvider;
use App\Providers\TenancyServiceProvider;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

$providers = [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    TenancyServiceProvider::class,
    HorizonServiceProvider::class,
];

if (class_exists(TelescopeApplicationServiceProvider::class)) {
    $providers[] = TelescopeServiceProvider::class;
}

return $providers;
