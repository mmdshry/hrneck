<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Actions\ManageAvatar;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Target;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TargetAvatarController extends Controller
{
    public function show(int $target, ManageAvatar $avatars): StreamedResponse
    {
        $model = Target::query()->findOrFail($target);

        return $avatars->stream($model->avatar_path);
    }

    public function store(Request $request, int $target, ManageAvatar $avatars, LogOrgActivity $audit): JsonResponse
    {
        $model = Target::query()->findOrFail($target);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:2048', 'mimetypes:image/png,image/jpeg,image/webp,image/jpg'],
        ]);

        $result = $avatars->uploadForTarget($model, $data['file']);
        $fresh = $result['target'] ?? $model->fresh();

        $audit->handle('targets', 'avatar_uploaded', 'Employee avatar uploaded', $fresh, [
            'avatar_path' => $result['path'],
        ]);

        PublishLive::org([LiveTopics::TARGETS, LiveTopics::USERS, LiveTopics::REPORTS_DETAILED]);

        return response()->json([
            'data' => $this->payload($fresh),
        ]);
    }

    public function destroy(int $target, ManageAvatar $avatars, LogOrgActivity $audit): JsonResponse
    {
        $model = Target::query()->findOrFail($target);
        $result = $avatars->clearForTarget($model);
        $fresh = $result['target'] ?? $model->fresh();

        $audit->handle('targets', 'avatar_removed', 'Employee avatar removed', $fresh, []);

        PublishLive::org([LiveTopics::TARGETS, LiveTopics::USERS, LiveTopics::REPORTS_DETAILED]);

        return response()->json([
            'data' => $this->payload($fresh),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(?Target $target): array
    {
        abort_unless($target !== null, 404);
        $data = $target->toArray();
        $data['avatar_url'] = filled($target->avatar_path)
            ? '/api/v1/org/targets/'.$target->id.'/avatar'
            : null;

        return $data;
    }
}
