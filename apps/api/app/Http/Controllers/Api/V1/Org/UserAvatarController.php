<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Actions\ManageAvatar;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserAvatarController extends Controller
{
    public function show(int $user, ManageAvatar $avatars): StreamedResponse
    {
        $model = $this->tenantUser($user);

        return $avatars->stream($model->avatar_path);
    }

    public function store(Request $request, int $user, ManageAvatar $avatars, LogOrgActivity $audit): JsonResponse
    {
        $model = $this->tenantUser($user);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:2048', 'mimetypes:image/png,image/jpeg,image/webp,image/jpg'],
        ]);

        $result = $avatars->uploadForUser($model, $data['file']);

        $audit->handle('users', 'avatar_uploaded', 'Org user avatar uploaded', $result['user'], [
            'avatar_path' => $result['path'],
        ]);

        PublishLive::org([LiveTopics::USERS, LiveTopics::TARGETS, LiveTopics::REPORTS_DETAILED]);

        return response()->json([
            'data' => new UserResource($result['user'] ?? $model->fresh()),
        ]);
    }

    public function destroy(int $user, ManageAvatar $avatars, LogOrgActivity $audit): JsonResponse
    {
        $model = $this->tenantUser($user);
        $result = $avatars->clearForUser($model);

        $audit->handle('users', 'avatar_removed', 'Org user avatar removed', $result['user'], []);

        PublishLive::org([LiveTopics::USERS, LiveTopics::TARGETS, LiveTopics::REPORTS_DETAILED]);

        return response()->json([
            'data' => new UserResource($result['user'] ?? $model->fresh()),
        ]);
    }

    private function tenantUser(int $userId): User
    {
        $tenantId = (string) tenant('id');

        return User::query()->inTenant($tenantId)->whereKey($userId)->firstOrFail();
    }
}
