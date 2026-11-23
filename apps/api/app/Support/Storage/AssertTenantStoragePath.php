<?php

namespace App\Support\Storage;

use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

final class AssertTenantStoragePath
{
    /**
     * Ensure a relative disk path stays under tenants/{tenantId}/{segment}/
     * with no traversal, and optionally that the file exists on the disk.
     *
     * @throws ValidationException
     */
    public static function handle(
        ?string $path,
        string $segment,
        string $disk = 'local',
        bool $mustExist = true,
        string $attribute = 'path',
    ): string {
        if ($path === null || $path === '') {
            throw ValidationException::withMessages([
                $attribute => ['A storage path is required.'],
            ]);
        }

        if (str_contains($path, '\\') || str_contains($path, "\0") || str_contains($path, '..')) {
            throw ValidationException::withMessages([
                $attribute => ['Invalid storage path.'],
            ]);
        }

        $normalized = ltrim(str_replace('\\', '/', $path), '/');

        if ($normalized === '' || str_contains($normalized, '..')) {
            throw ValidationException::withMessages([
                $attribute => ['Invalid storage path.'],
            ]);
        }

        $tenantId = tenant('id');
        if (! is_string($tenantId) || $tenantId === '') {
            throw ValidationException::withMessages([
                $attribute => ['Tenant context is required for storage paths.'],
            ]);
        }

        $prefix = 'tenants/'.$tenantId.'/'.$segment.'/';
        if (! str_starts_with($normalized, $prefix)) {
            throw ValidationException::withMessages([
                $attribute => ['Storage path is outside the allowed directory.'],
            ]);
        }

        $rest = substr($normalized, strlen($prefix));
        if ($rest === '' || str_contains($rest, '..')) {
            throw ValidationException::withMessages([
                $attribute => ['Invalid storage path.'],
            ]);
        }

        if ($mustExist && ! Storage::disk($disk)->exists($normalized)) {
            throw ValidationException::withMessages([
                $attribute => ['Storage file was not found.'],
            ]);
        }

        return $normalized;
    }
}
