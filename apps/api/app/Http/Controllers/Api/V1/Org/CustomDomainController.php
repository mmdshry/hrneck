<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\CustomDomains\Actions\BuildDnsGuidance;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomDomainController extends Controller
{
    public function show(BuildDnsGuidance $guidance): JsonResponse
    {
        $settings = DB::table('organization_settings')->first();
        $meta = json_decode((string) ($settings->meta ?? '{}'), true) ?: [];
        $domain = (string) ($meta['sending_domain'] ?? '');

        return response()->json([
            'data' => [
                // Flag is defined in AppServiceProvider; avoid tenant-scoped Pennant DB lookups.
                'enabled' => true,
                'sending_domain' => $domain !== '' ? $domain : null,
                'guidance' => $domain !== '' ? $guidance->handle($domain) : null,
            ],
        ]);
    }

    public function update(Request $request, BuildDnsGuidance $guidance, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'sending_domain' => ['required', 'string', 'max:190'],
        ]);

        $settings = DB::table('organization_settings')->first();
        $meta = json_decode((string) ($settings->meta ?? '{}'), true) ?: [];
        $meta['sending_domain'] = strtolower($data['sending_domain']);

        DB::table('organization_settings')->updateOrInsert(
            ['id' => 1],
            [
                'meta' => json_encode($meta, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
                'created_at' => $settings->created_at ?? now(),
            ],
        );

        $audit->handle('settings', 'domain_updated', 'Sending domain updated', null, [
            'sending_domain' => $meta['sending_domain'],
        ]);

        return response()->json([
            'data' => [
                'sending_domain' => $meta['sending_domain'],
                'guidance' => $guidance->handle($meta['sending_domain']),
            ],
        ]);
    }
}
