<?php

use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;
use App\Providers\HorizonServiceProvider;
use App\Providers\TelescopeServiceProvider;
use App\Providers\TenancyServiceProvider;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

return [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    HorizonServiceProvider::class,
    // laravel/telescope is a require-dev package; production runs composer install --no-dev.
    ...(class_exists(TelescopeApplicationServiceProvider::class) ? [TelescopeServiceProvider::class] : []),
    TenancyServiceProvider::class,
];
