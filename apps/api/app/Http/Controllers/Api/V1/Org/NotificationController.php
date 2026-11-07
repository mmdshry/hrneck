<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Notifications\Actions\MarkNotificationsRead;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Notifications\Support\NotificationPayload;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $query = UserNotification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at');

        $paginator = $query->paginate(ApiPagination::perPage($request));
        $unread = UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => NotificationPayload::notificationList($paginator->getCollection()),
            'meta' => [
                ...ApiPagination::meta($paginator),
                'unread_count' => $unread,
            ],
        ]);
    }

    public function markRead(Request $request, MarkNotificationsRead $action): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $data = $request->validate([
            'ids' => ['sometimes', 'array'],
            'ids.*' => ['integer'],
            'all' => ['sometimes', 'boolean'],
        ]);

        $updated = $action->handle(
            (int) $user->id,
            isset($data['ids']) ? array_map('intval', $data['ids']) : null,
            (bool) ($data['all'] ?? false),
        );

        $unread = UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => [
                'updated' => $updated,
                'unread_count' => $unread,
            ],
        ]);
    }
}
