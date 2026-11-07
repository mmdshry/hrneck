<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'brand' => config('brand.short'),
            'name' => config('brand.name'),
            'domain' => config('brand.tenancy_base_domain'),
        ]);
    }
}
