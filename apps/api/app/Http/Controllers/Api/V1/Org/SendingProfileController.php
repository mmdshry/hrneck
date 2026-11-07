<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\MailDelivery\Models\SendingProfile;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SendingProfileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = SendingProfile::query()
            ->orderByDesc('is_default')
            ->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'from_name' => ['required', 'string', 'max:120'],
            'from_email' => ['required', 'email'],
            'mailer' => ['sometimes', 'string', 'max:40'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        if ($request->boolean('is_default')) {
            SendingProfile::query()->update(['is_default' => false]);
        }

        $profile = SendingProfile::query()->create($data + [
            'mailer' => $data['mailer'] ?? 'smtp',
            'is_default' => $request->boolean('is_default', false),
        ]);

        $audit->handle('settings', 'sending_profile_created', 'Sending profile created', $profile, [
            'name' => $profile->name,
            'from_email' => $profile->from_email,
        ]);

        PublishLive::org([LiveTopics::SENDING_PROFILES]);

        return response()->json(['data' => $profile], 201);
    }

    public function update(Request $request, SendingProfile $sendingProfile, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'from_name' => ['sometimes', 'string', 'max:120'],
            'from_email' => ['sometimes', 'email'],
            'mailer' => ['sometimes', 'string', 'max:40'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        if (($data['is_default'] ?? false) === true) {
            SendingProfile::query()->where('id', '!=', $sendingProfile->id)->update(['is_default' => false]);
        }

        $before = $sendingProfile->only(['name', 'from_name', 'from_email', 'mailer', 'is_default']);
        $sendingProfile->fill($data)->save();

        $audit->handle('settings', 'sending_profile_updated', 'Sending profile updated', $sendingProfile, [
            'before' => $before,
            'after' => $sendingProfile->only(['name', 'from_name', 'from_email', 'mailer', 'is_default']),
        ]);

        PublishLive::org([LiveTopics::SENDING_PROFILES]);

        return response()->json(['data' => $sendingProfile]);
    }

    public function destroy(SendingProfile $sendingProfile, LogOrgActivity $audit): JsonResponse
    {
        $snapshot = $sendingProfile->only(['id', 'name', 'from_email']);
        $sendingProfile->delete();

        $audit->handle('settings', 'sending_profile_deleted', 'Sending profile deleted', null, [
            'profile' => $snapshot,
        ]);

        PublishLive::org([LiveTopics::SENDING_PROFILES]);

        return response()->json(['message' => 'Deleted']);
    }
}
