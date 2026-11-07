<?php

use App\Support\Images\ConvertUploadedImageToWebp;
use Illuminate\Http\UploadedFile;

test('raster images are converted to webp', function () {
    $file = UploadedFile::fake()->image('photo.png', 32, 32);
    $result = app(ConvertUploadedImageToWebp::class)->handle($file);

    expect($result['extension'])->toBe('webp')
        ->and($result['mime'])->toBe('image/webp')
        ->and($result['converted'])->toBeTrue()
        ->and($result['contents'])->not->toBe('')
        ->and(substr($result['contents'], 0, 4))->toBe('RIFF');
});

test('jpeg images are converted to webp', function () {
    $file = UploadedFile::fake()->image('photo.jpg', 24, 24);
    $result = app(ConvertUploadedImageToWebp::class)->handle($file);

    expect($result['extension'])->toBe('webp')
        ->and($result['mime'])->toBe('image/webp')
        ->and($result['converted'])->toBeTrue();
});

test('svg uploads stay svg', function () {
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
    $path = tempnam(sys_get_temp_dir(), 'svg');
    file_put_contents($path, $svg);
    $file = new UploadedFile($path, 'logo.svg', 'image/svg+xml', null, true);

    $result = app(ConvertUploadedImageToWebp::class)->handle($file);

    expect($result['extension'])->toBe('svg')
        ->and($result['mime'])->toBe('image/svg+xml')
        ->and($result['converted'])->toBeFalse()
        ->and($result['contents'])->toBe($svg);

    @unlink($path);
});

test('non-image uploads stay untouched', function () {
    $file = UploadedFile::fake()->create('notes.pdf', 20, 'application/pdf');
    $result = app(ConvertUploadedImageToWebp::class)->handle($file);

    expect($result['extension'])->toBe('pdf')
        ->and($result['mime'])->toBe('application/pdf')
        ->and($result['converted'])->toBeFalse();
});

test('webp uploads are stored as webp without re-encoding', function () {
    $png = UploadedFile::fake()->image('source.png', 16, 16);
    $converted = app(ConvertUploadedImageToWebp::class)->handle($png);

    $path = tempnam(sys_get_temp_dir(), 'webp').'.webp';
    file_put_contents($path, $converted['contents']);
    $file = new UploadedFile($path, 'logo.webp', 'image/webp', null, true);

    $result = app(ConvertUploadedImageToWebp::class)->handle($file);

    expect($result['extension'])->toBe('webp')
        ->and($result['mime'])->toBe('image/webp')
        ->and($result['converted'])->toBeFalse()
        ->and($result['contents'])->toBe($converted['contents']);

    @unlink($path);
});
