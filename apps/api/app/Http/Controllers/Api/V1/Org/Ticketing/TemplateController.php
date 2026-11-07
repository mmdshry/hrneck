<?php

namespace App\Http\Controllers\Api\V1\Org\Ticketing;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Ticketing\Models\SdMessageTemplate;
use App\Domains\Ticketing\Models\SdNoteTemplate;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $deskId = $request->filled('desk_id') ? (int) $request->input('desk_id') : null;

        $messages = SdMessageTemplate::query()
            ->when($deskId, fn ($q) => $q->where(fn ($q2) => $q2->whereNull('desk_id')->orWhere('desk_id', $deskId)))
            ->orderBy('name')
            ->get();
        $notes = SdNoteTemplate::query()
            ->when($deskId, fn ($q) => $q->where(fn ($q2) => $q2->whereNull('desk_id')->orWhere('desk_id', $deskId)))
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => [
                'messages' => $messages,
                'notes' => $notes,
            ],
        ]);
    }

    public function storeMessage(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'desk_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:160'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $template = SdMessageTemplate::query()->create($data);

        $audit->handle('ticketing', 'message_template_created', 'Message template created', $template, [
            'name' => $template->name,
        ]);

        return response()->json(['data' => $template], 201);
    }

    public function destroyMessage(int $template, LogOrgActivity $audit): JsonResponse
    {
        $model = SdMessageTemplate::query()->findOrFail($template);
        $snapshot = ['id' => $model->id, 'name' => $model->name];
        $model->delete();

        $audit->handle('ticketing', 'message_template_deleted', 'Message template deleted', null, [
            'template' => $snapshot,
        ]);

        return response()->json(['message' => 'Deleted']);
    }

    public function storeNote(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'desk_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:160'],
            'body' => ['required', 'string'],
        ]);

        $template = SdNoteTemplate::query()->create($data);

        $audit->handle('ticketing', 'note_template_created', 'Note template created', $template, [
            'name' => $template->name,
        ]);

        return response()->json(['data' => $template], 201);
    }

    public function destroyNote(int $template, LogOrgActivity $audit): JsonResponse
    {
        $model = SdNoteTemplate::query()->findOrFail($template);
        $snapshot = ['id' => $model->id, 'name' => $model->name];
        $model->delete();

        $audit->handle('ticketing', 'note_template_deleted', 'Note template deleted', null, [
            'template' => $snapshot,
        ]);

        return response()->json(['message' => 'Deleted']);
    }
}
