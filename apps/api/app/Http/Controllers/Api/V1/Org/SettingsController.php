<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        $row = DB::table('organization_settings')->first();
        if ($row) {
            $row->meta = json_decode((string) ($row->meta ?? '{}'), true) ?: [];
        }

        return response()->json(['data' => $row]);
    }

    public function update(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'display_name' => ['nullable', 'string', 'max:160'],
            'primary_color' => ['nullable', 'string', 'max:20'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'logo_path' => ['nullable', 'string', 'max:255'],
            'sending_domain' => ['nullable', 'string', 'max:190'],
            'webhook_url' => ['nullable', 'url'],
        ]);

        $existing = DB::table('organization_settings')->first();
        $meta = json_decode((string) ($existing->meta ?? '{}'), true) ?: [];

        if (array_key_exists('sending_domain', $data)) {
            $meta['sending_domain'] = $data['sending_domain']
                ? strtolower((string) $data['sending_domain'])
                : null;
        }
        if (array_key_exists('webhook_url', $data)) {
            $meta['webhook_url'] = $data['webhook_url'];
        }

        unset($data['sending_domain'], $data['webhook_url']);

        DB::table('organization_settings')->updateOrInsert(
            ['id' => 1],
            $data + [
                'meta' => json_encode($meta, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
                'created_at' => $existing->created_at ?? now(),
            ],
        );

        $audit->handle('settings', 'updated', 'Organization settings updated', null, [
            'fields' => array_keys($data),
        ]);

        PublishLive::org([LiveTopics::BRANDING]);

        return $this->show();
    }
}
