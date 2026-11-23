<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Actions\ManageAvatar;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuthAvatarController extends Controller
{
    public function show(Request $request, ManageAvatar $avatars): StreamedResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        return $avatars->stream($user->avatar_path);
    }

    public function store(Request $request, ManageAvatar $avatars, LogOrgActivity $audit): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:2048', 'mimetypes:image/png,image/jpeg,image/webp,image/jpg'],
        ]);

        $result = $avatars->uploadForUser($user, $data['file']);

        $audit->handle('users', 'avatar_uploaded', 'User avatar uploaded', $result['user'], [
            'avatar_path' => $result['path'],
            'self' => true,
        ]);

        $publishTenant = $user->resolvedActiveTenantId() ?? $user->tenant_id;
        if ($publishTenant) {
            PublishLive::org([LiveTopics::USERS, LiveTopics::TARGETS], (string) $publishTenant);
        }

        return response()->json([
            'data' => new UserResource($result['user'] ?? $user->fresh()),
        ]);
    }

    public function destroy(Request $request, ManageAvatar $avatars, LogOrgActivity $audit): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $result = $avatars->clearForUser($user);

        $audit->handle('users', 'avatar_removed', 'User avatar removed', $result['user'], [
            'self' => true,
        ]);

        $publishTenant = $user->resolvedActiveTenantId() ?? $user->tenant_id;
        if ($publishTenant) {
            PublishLive::org([LiveTopics::USERS, LiveTopics::TARGETS], (string) $publishTenant);
        }

        return response()->json([
            'data' => new UserResource($result['user'] ?? $user->fresh()),
        ]);
    }
}
