<?php

namespace App\Support\Images;

use Illuminate\Http\UploadedFile;
use RuntimeException;

final class ConvertUploadedImageToWebp
{
    /**
     * @return array{contents: string, extension: string, mime: string, converted: bool}
     */
    public function handle(UploadedFile $file): array
    {
        $mime = strtolower((string) ($file->getMimeType() ?: $file->getClientMimeType() ?: ''));
        $extension = strtolower($file->getClientOriginalExtension() ?: pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION) ?: '');

        if ($this->isSvg($mime, $extension)) {
            return [
                'contents' => $this->readContents($file),
                'extension' => 'svg',
                'mime' => 'image/svg+xml',
                'converted' => false,
            ];
        }

        if (! $this->isRasterImage($mime, $extension)) {
            return [
                'contents' => $this->readContents($file),
                'extension' => $extension !== '' ? $extension : 'bin',
                'mime' => $mime !== '' ? $mime : 'application/octet-stream',
                'converted' => false,
            ];
        }

        if ($mime === 'image/webp' || $extension === 'webp') {
            return [
                'contents' => $this->readContents($file),
                'extension' => 'webp',
                'mime' => 'image/webp',
                'converted' => false,
            ];
        }

        if (! function_exists('imagecreatefromstring') || ! function_exists('imagewebp')) {
            throw new RuntimeException('GD WebP support is required to convert uploaded images.');
        }

        $binary = $this->readContents($file);
        $image = @imagecreatefromstring($binary);
        if ($image === false) {
            throw new RuntimeException('Unable to decode uploaded image for WebP conversion.');
        }

        imagealphablending($image, true);
        imagesavealpha($image, true);

        ob_start();
        $ok = imagewebp($image, null, 82);
        $webp = (string) ob_get_clean();
        imagedestroy($image);

        if (! $ok || $webp === '') {
            throw new RuntimeException('Unable to encode uploaded image as WebP.');
        }

        return [
            'contents' => $webp,
            'extension' => 'webp',
            'mime' => 'image/webp',
            'converted' => true,
        ];
    }

    private function readContents(UploadedFile $file): string
    {
        $path = $file->getRealPath();
        if ($path === false) {
            throw new RuntimeException('Uploaded file path is unavailable.');
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new RuntimeException('Unable to read uploaded file contents.');
        }

        return $contents;
    }

    private function isSvg(string $mime, string $extension): bool
    {
        return $mime === 'image/svg+xml' || $extension === 'svg';
    }

    private function isRasterImage(string $mime, string $extension): bool
    {
        if (str_starts_with($mime, 'image/') && $mime !== 'image/svg+xml') {
            return true;
        }

        return in_array($extension, ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'], true);
    }
}
