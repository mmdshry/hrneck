<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Notifications\Actions\FanOutAnnouncement;
use App\Domains\Notifications\Models\OrgAnnouncement;
use App\Domains\Notifications\Support\NotificationPayload;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = OrgAnnouncement::query()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $rows->map(fn (OrgAnnouncement $row) => NotificationPayload::announcement($row))->values()->all(),
        ]);
    }

    public function store(Request $request, FanOutAnnouncement $fanOut, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $announcement = $fanOut->handle(
            $data['title'],
            $data['body'],
            $request->user()?->id,
        );

        $audit->handle('announcements', 'created', 'Announcement published', $announcement, [
            'title' => $announcement->title,
        ]);

        return response()->json([
            'data' => NotificationPayload::announcement($announcement),
        ], 201);
    }

    public function update(Request $request, int $announcement, LogOrgActivity $audit): JsonResponse
    {
        $model = OrgAnnouncement::query()->findOrFail($announcement);
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:190'],
            'body' => ['sometimes', 'string', 'max:5000'],
        ]);

        $before = $model->only(['title', 'body']);
        $model->fill($data)->save();

        $audit->handle('announcements', 'updated', 'Announcement updated', $model, [
            'before' => $before,
            'after' => $model->only(['title', 'body']),
        ]);

        return response()->json([
            'data' => NotificationPayload::announcement($model),
        ]);
    }

    public function destroy(int $announcement, LogOrgActivity $audit): JsonResponse
    {
        $model = OrgAnnouncement::query()->findOrFail($announcement);
        $snapshot = $model->only(['id', 'title']);
        $model->delete();

        $audit->handle('announcements', 'deleted', 'Announcement deleted', null, [
            'announcement' => $snapshot,
        ]);

        return response()->json(['message' => 'Deleted']);
    }
}