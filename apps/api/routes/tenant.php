<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;

/*
| Tenant host UI is served by Next.js. Laravel tenant routes stay minimal:
| domain initialization hooks exist for future asset/webhooks if needed.
*/

Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->group(function () {
    Route::get('/tenant-health', function () {
        return response()->json([
            'ok' => true,
            'tenant' => tenant('id'),
        ]);
    });
});
