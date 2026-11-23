<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\AvatarStorage;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Images\ConvertUploadedImageToWebp;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Facades\Tenancy;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ManageAvatar
{
    public function __construct(private readonly ConvertUploadedImageToWebp $toWebp) {}

    /**
     * @return array{path: string, user: User|null, target: Target|null}
     */
    public function uploadForUser(User $user, UploadedFile $file): array
    {
        $this->assertRasterImage($file);
        $path = $this->storeConverted($file, $user->resolvedActiveTenantId() ?? $user->tenant_id);

        $previous = $user->avatar_path;
        $user->forceFill(['avatar_path' => $path])->save();

        $target = $this->linkedTargetForUser($user);
        if ($target !== null) {
            $targetPrevious = $target->avatar_path;
            $target->forceFill(['avatar_path' => $path])->save();
            if ($targetPrevious !== $previous) {
                AvatarStorage::deleteIfUnreferenced($targetPrevious, $path);
            }
        }

        AvatarStorage::deleteIfUnreferenced($previous, $path);

        return ['path' => $path, 'user' => $user->fresh(), 'target' => $target?->fresh()];
    }

    /**
     * @return array{path: string, user: User|null, target: Target|null}
     */
    public function uploadForTarget(Target $target, UploadedFile $file, ?string $tenantId = null): array
    {
        $this->assertRasterImage($file);
        $tenantId = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null);
        $path = $this->storeConverted($file, $tenantId);

        $previous = $target->avatar_path;
        $target->forceFill(['avatar_path' => $path])->save();

        $user = $this->linkedUserForTarget($target);
        if ($user !== null) {
            $userPrevious = $user->avatar_path;
            $user->forceFill(['avatar_path' => $path])->save();
            if ($userPrevious !== $previous) {
                AvatarStorage::deleteIfUnreferenced($userPrevious, $path);
            }
        }

        AvatarStorage::deleteIfUnreferenced($previous, $path);

        return ['path' => $path, 'user' => $user?->fresh(), 'target' => $target->fresh()];
    }

    /**
     * @return array{user: User|null, target: Target|null}
     */
    public function clearForUser(User $user): array
    {
        $previous = $user->avatar_path;
        $user->forceFill(['avatar_path' => null])->save();

        $target = $this->linkedTargetForUser($user);
        if ($target !== null && $target->avatar_path === $previous) {
            $target->forceFill(['avatar_path' => null])->save();
        }

        AvatarStorage::deleteIfUnreferenced($previous);

        return ['user' => $user->fresh(), 'target' => $target?->fresh()];
    }

    /**
     * @return array{user: User|null, target: Target|null}
     */
    public function clearForTarget(Target $target): array
    {
        $previous = $target->avatar_path;
        $target->forceFill(['avatar_path' => null])->save();

        $user = $this->linkedUserForTarget($target);
        if ($user !== null && $user->avatar_path === $previous) {
            $user->forceFill(['avatar_path' => null])->save();
        }

        AvatarStorage::deleteIfUnreferenced($previous);

        return ['user' => $user?->fresh(), 'target' => $target->fresh()];
    }

    public function stream(?string $path): StreamedResponse
    {
        abort_unless(AvatarStorage::exists($path), 404);

        /** @var string $path */
        return Storage::disk(AvatarStorage::disk())->response(
            $path,
            basename($path),
            [
                'Content-Type' => AvatarStorage::mimeForPath($path),
                'Content-Disposition' => 'inline; filename="'.basename($path).'"',
                'Cache-Control' => 'private, max-age=300',
            ],
        );
    }

    public function linkedTargetForUser(User $user): ?Target
    {
        $tenantId = is_string(tenant('id')) && tenant('id') !== ''
            ? (string) tenant('id')
            : ($user->resolvedActiveTenantId() ?? (is_string($user->tenant_id) ? (string) $user->tenant_id : null));

        if ($tenantId === null || ! $user->belongsToTenant($tenantId)) {
            return null;
        }

        $run = function () use ($user): ?Target {
            $byId = Target::query()->where('user_id', $user->id)->first();
            if ($byId !== null) {
                return $byId;
            }

            $email = strtolower(trim((string) $user->email));
            if ($email === '') {
                return null;
            }

            return Target::query()->whereRaw('LOWER(email) = ?', [$email])->first();
        };

        if (tenancy()->initialized && (string) tenant('id') === $tenantId) {
            return $run();
        }

        $tenant = Tenant::query()->find($tenantId);
        if ($tenant === null) {
            return null;
        }

        $previous = tenancy()->initialized ? tenancy()->tenant : null;
        Tenancy::initialize($tenant);
        try {
            return $run();
        } finally {
            if ($previous !== null) {
                Tenancy::initialize($previous);
            } else {
                Tenancy::end();
            }
        }
    }

    public function linkedUserForTarget(Target $target): ?User
    {
        if ($target->user_id !== null) {
            $user = User::query()->find($target->user_id);
            if ($user !== null) {
                return $user;
            }
        }

        $email = strtolower(trim((string) $target->email));
        if ($email === '') {
            return null;
        }

        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;

        return User::query()
            ->when($tenantId !== null, fn ($q) => $q->inTenant($tenantId))
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();
    }

    private function storeConverted(UploadedFile $file, ?string $tenantId): string
    {
        $converted = $this->toWebp->handle($file);
        if (
            $converted['mime'] === 'image/svg+xml'
            || $converted['extension'] === 'svg'
            || ! in_array($converted['mime'], ['image/webp', 'image/jpeg', 'image/png'], true)
        ) {
            throw ValidationException::withMessages([
                'file' => ['Avatar must be a JPEG, PNG, or WebP image.'],
            ]);
        }

        $tenant = $tenantId !== null && $tenantId !== '' ? $tenantId : 'central';
        $path = sprintf('tenants/%s/avatars/%s.webp', $tenant, Str::uuid()->toString());
        Storage::disk(AvatarStorage::disk())->put($path, $converted['contents']);

        return $path;
    }

    private function assertRasterImage(UploadedFile $file): void
    {
        $mime = strtolower((string) ($file->getMimeType() ?: $file->getClientMimeType() ?: ''));
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (! in_array($mime, $allowed, true)) {
            throw ValidationException::withMessages([
                'file' => ['Avatar must be a JPEG, PNG, or WebP image.'],
            ]);
        }
    }
}
