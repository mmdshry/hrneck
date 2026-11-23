<?php

namespace App\Domains\IdentityAccess\Support;

use Illuminate\Support\Facades\Storage;

final class AvatarStorage
{
    public static function disk(): string
    {
        return (string) config('filesystems.training_disk', 'local');
    }

    public static function mimeForPath(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'image/webp',
        };
    }

    public static function exists(?string $path): bool
    {
        return is_string($path) && $path !== '' && Storage::disk(self::disk())->exists($path);
    }

    public static function deleteIfUnreferenced(?string $path, ?string $keepIfEquals = null): void
    {
        if (! is_string($path) || $path === '') {
            return;
        }

        if ($keepIfEquals !== null && $path === $keepIfEquals) {
            return;
        }

        if (Storage::disk(self::disk())->exists($path)) {
            Storage::disk(self::disk())->delete($path);
        }
    }
}
