<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Http\Controllers\Controller;
use App\Support\Images\ConvertUploadedImageToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BrandingController extends Controller
{
    public function show(): JsonResponse
    {
        $row = DB::table('organization_settings')->first();
        $hasLogo = $row && filled($row->logo_path ?? null);

        return response()->json([
            'data' => [
                'display_name' => $row->display_name ?? null,
                'primary_color' => $row->primary_color ?? null,
                'logo_path' => $hasLogo ? $row->logo_path : null,
                'logo_url' => $hasLogo ? '/api/v1/org/branding/logo' : null,
            ],
        ]);
    }

    public function uploadLogo(Request $request, LogOrgActivity $audit, ConvertUploadedImageToWebp $toWebp): JsonResponse
    {
        $data = $request->validate([
            'file' => [
                'required',
                'file',
                'max:2048',
                'mimetypes:image/png,image/jpeg,image/webp,image/svg+xml',
            ],
        ]);

        $file = $data['file'];
        $converted = $toWebp->handle($file);
        $tenant = (string) (tenant('id') ?: 'central');
        $ext = $converted['extension'];
        if (! in_array($ext, ['webp', 'svg'], true)) {
            $ext = 'webp';
        }

        $disk = $this->brandingDisk();
        $existing = DB::table('organization_settings')->first();
        if ($existing && filled($existing->logo_path ?? null) && Storage::disk($disk)->exists($existing->logo_path)) {
            Storage::disk($disk)->delete($existing->logo_path);
        }

        $path = sprintf('tenants/%s/branding/logo-%s.%s', $tenant, Str::uuid()->toString(), $ext);
        Storage::disk($disk)->put($path, $converted['contents']);

        DB::table('organization_settings')->updateOrInsert(
            ['id' => 1],
            [
                'logo_path' => $path,
                'updated_at' => now(),
                'created_at' => $existing->created_at ?? now(),
                'display_name' => $existing->display_name ?? null,
                'primary_color' => $existing->primary_color ?? '#0f766e',
                'timezone' => $existing->timezone ?? 'UTC',
                'meta' => $existing->meta ?? '{}',
            ],
        );

        $audit->handle('settings', 'logo_uploaded', 'Organization logo uploaded', null, [
            'logo_path' => $path,
        ]);

        return $this->show();
    }

    public function streamLogo(): StreamedResponse|JsonResponse
    {
        $row = DB::table('organization_settings')->first();
        abort_unless($row && filled($row->logo_path ?? null), 404);

        $disk = $this->brandingDisk();
        abort_unless(Storage::disk($disk)->exists($row->logo_path), 404);

        $mime = match (strtolower(pathinfo($row->logo_path, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            default => 'image/png',
        };

        return Storage::disk($disk)->response(
            $row->logo_path,
            basename($row->logo_path),
            [
                'Content-Type' => $mime,
                'Content-Disposition' => 'inline; filename="'.basename($row->logo_path).'"',
                'Cache-Control' => 'private, max-age=300',
            ],
        );
    }

    private function brandingDisk(): string
    {
        return (string) config('filesystems.training_disk', 'local');
    }
}
