<?php

namespace App\Http\Controllers\Api\V1\Org\Ticketing;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Ticketing\Actions\ConvertTicketToKb;
use App\Domains\Ticketing\Actions\CreateTicket;
use App\Domains\Ticketing\Actions\ImportExportTickets;
use App\Domains\Ticketing\Actions\ManageTicketBulk;
use App\Domains\Ticketing\Actions\UpdateTicket;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketAttachment;
use App\Domains\Ticketing\Models\SdTicketNote;
use App\Domains\Ticketing\Models\SdTicketTask;
use App\Domains\Ticketing\Models\SdUserPreference;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\Images\ConvertUploadedImageToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SdTicket::query()->with(['desk', 'stage', 'status', 'priority']);

        if ($request->boolean('archived')) {
            $query->archived();
        } else {
            $query->active();
        }

        if ($request->filled('desk_id')) {
            $query->where('desk_id', (int) $request->input('desk_id'));
        }
        if ($request->filled('assignee_user_id')) {
            $query->where('assignee_user_id', (int) $request->input('assignee_user_id'));
        }
        if ($request->filled('assignee_pool')) {
            $query->where('assignee_pool', (string) $request->input('assignee_pool'));
        }
        if ($request->filled('stage_id')) {
            $query->where('stage_id', (int) $request->input('stage_id'));
        }
        if ($request->filled('q')) {
            $q = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->input('q')).'%';
            $query->where(function ($builder) use ($q): void {
                $builder->where('summary', 'like', $q)
                    ->orWhere('number', 'like', $q)
                    ->orWhere('description', 'like', $q);
            });
        }

        $prefs = SdUserPreference::query()->where('user_id', $request->user()?->id)->first();
        if ($prefs?->ticket_scope === 'assigned') {
            $query->where('assignee_user_id', $request->user()?->id);
        } elseif ($prefs?->ticket_scope === 'own') {
            $query->where('requester_user_id', $request->user()?->id);
        }

        $rows = $query->latest()->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (SdTicket $t) => TicketingPayload::ticket($t))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, CreateTicket $action, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'desk_id' => ['required', 'integer'],
            'summary' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'stage_id' => ['nullable', 'integer'],
            'status_id' => ['nullable', 'integer'],
            'priority_id' => ['nullable', 'integer'],
            'severity_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'requester_user_id' => ['nullable', 'integer'],
            'requester_target_id' => ['nullable', 'integer'],
            'assignee_user_id' => ['nullable', 'integer'],
            'assignee_pool' => ['nullable', 'string', 'max:120'],
            'custom_fields' => ['nullable', 'array'],
        ]);

        $ticket = $action->handle($data, $request->user()?->id);

        $audit->handle('ticketing', 'ticket_created', 'Ticket created', $ticket, [
            'number' => $ticket->number,
            'desk_id' => $ticket->desk_id,
        ]);

        return response()->json(['data' => TicketingPayload::ticket($ticket, detailed: true)], 201);
    }

    public function show(int $ticket): JsonResponse
    {
        $model = SdTicket::query()
            ->with(['desk', 'stage', 'status', 'priority', 'severity', 'category', 'notes', 'tasks', 'attachments', 'links'])
            ->findOrFail($ticket);

        return response()->json(['data' => TicketingPayload::ticket($model, detailed: true)]);
    }

    public function update(Request $request, int $ticket, UpdateTicket $action, LogOrgActivity $audit): JsonResponse
    {
        $model = SdTicket::query()->findOrFail($ticket);
        $data = $request->validate([
            'summary' => ['sometimes', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'stage_id' => ['sometimes', 'integer'],
            'status_id' => ['sometimes', 'nullable', 'integer'],
            'priority_id' => ['sometimes', 'nullable', 'integer'],
            'severity_id' => ['sometimes', 'nullable', 'integer'],
            'category_id' => ['sometimes', 'nullable', 'integer'],
            'requester_user_id' => ['sometimes', 'nullable', 'integer'],
            'requester_target_id' => ['sometimes', 'nullable', 'integer'],
            'assignee_user_id' => ['sometimes', 'nullable', 'integer'],
            'assignee_pool' => ['sometimes', 'nullable', 'string', 'max:120'],
            'custom_fields' => ['sometimes', 'nullable', 'array'],
            'is_unread' => ['sometimes', 'boolean'],
            'mark_responded' => ['sometimes', 'boolean'],
        ]);

        $updated = $action->handle($model, $data, $request->user()?->id);

        $audit->handle('ticketing', 'ticket_updated', 'Ticket updated', $updated, [
            'number' => $updated->number,
            'fields' => array_keys($data),
        ]);

        return response()->json(['data' => TicketingPayload::ticket($updated, detailed: true)]);
    }

    public function bulk(Request $request, ManageTicketBulk $bulk, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'string', 'in:archive,unarchive,unlock,read,unread,stop_notification,delete,group_update,link,merge'],
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
            'fields' => ['sometimes', 'array'],
            'primary_id' => ['sometimes', 'integer'],
        ]);

        $ids = array_map('intval', $data['ids']);
        $result = match ($data['action']) {
            'archive' => ['affected' => $bulk->archive($ids)],
            'unarchive' => ['affected' => $bulk->unarchive($ids)],
            'unlock' => ['affected' => $bulk->unlock($ids)],
            'read' => ['affected' => $bulk->markRead($ids, false)],
            'unread' => ['affected' => $bulk->markRead($ids, true)],
            'stop_notification' => ['affected' => $bulk->stopNotification($ids)],
            'delete' => ['affected' => $bulk->delete($ids)],
            'group_update' => ['affected' => $bulk->groupUpdate($ids, $data['fields'] ?? [], $request->user()?->id)],
            'link' => tap(['ok' => true], fn () => $bulk->link($ids)),
            'merge' => [
                'data' => TicketingPayload::ticket(
                    $bulk->merge($ids, (int) ($data['primary_id'] ?? $ids[0]), $request->user()?->id),
                    detailed: true,
                ),
            ],
        };

        if (in_array($data['action'], ['archive', 'unarchive', 'delete', 'group_update', 'merge', 'link'], true)) {
            $audit->handle('ticketing', 'ticket_bulk_'.$data['action'], 'Ticket bulk '.$data['action'], null, [
                'ids' => $ids,
                'result' => $result['affected'] ?? true,
            ]);
        }

        return response()->json($result);
    }

    public function copy(Request $request, int $ticket, ManageTicketBulk $bulk): JsonResponse
    {
        $model = SdTicket::query()->with('notes')->findOrFail($ticket);
        $data = $request->validate([
            'desk_id' => ['required', 'integer'],
            'link' => ['sometimes', 'boolean'],
            'include_notes' => ['sometimes', 'boolean'],
            'summary' => ['sometimes', 'string', 'max:500'],
        ]);

        $copy = $bulk->copy(
            $model,
            (int) $data['desk_id'],
            array_filter([
                'summary' => $data['summary'] ?? null,
                'include_notes' => $data['include_notes'] ?? false,
            ], fn ($v) => $v !== null),
            (bool) ($data['link'] ?? true),
            $request->user()?->id,
        );

        return response()->json(['data' => TicketingPayload::ticket($copy, detailed: true)], 201);
    }

    public function convertToKb(Request $request, int $ticket, ConvertTicketToKb $action): JsonResponse
    {
        $model = SdTicket::query()->findOrFail($ticket);
        $data = $request->validate([
            'publish' => ['sometimes', 'boolean'],
        ]);

        $article = $action->handle($model, $request->user()?->id, (bool) ($data['publish'] ?? false));

        return response()->json(['data' => TicketingPayload::kb($article)], 201);
    }

    public function addNote(Request $request, int $ticket): JsonResponse
    {
        $model = SdTicket::query()->findOrFail($ticket);
        $data = $request->validate([
            'body' => ['required', 'string'],
            'is_public' => ['sometimes', 'boolean'],
        ]);

        $note = SdTicketNote::query()->create([
            'ticket_id' => $model->id,
            'body' => $data['body'],
            'is_public' => (bool) ($data['is_public'] ?? false),
            'author_user_id' => $request->user()?->id,
        ]);

        if (! $model->first_responded_at) {
            $model->first_responded_at = now();
            $model->save();
        }

        return response()->json(['data' => $note], 201);
    }

    public function addTask(Request $request, int $ticket): JsonResponse
    {
        $model = SdTicket::query()->findOrFail($ticket);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assignee_user_id' => ['nullable', 'integer'],
            'hours_worked' => ['nullable', 'numeric', 'min:0'],
            'is_completed' => ['sometimes', 'boolean'],
        ]);

        $task = SdTicketTask::query()->create([
            'ticket_id' => $model->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'assignee_user_id' => $data['assignee_user_id'] ?? null,
            'hours_worked' => $data['hours_worked'] ?? 0,
            'is_completed' => (bool) ($data['is_completed'] ?? false),
            'completed_at' => ! empty($data['is_completed']) ? now() : null,
        ]);

        return response()->json(['data' => $task], 201);
    }

    public function updateTask(Request $request, int $ticket, int $task): JsonResponse
    {
        $model = SdTicketTask::query()->where('ticket_id', $ticket)->findOrFail($task);
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assignee_user_id' => ['nullable', 'integer'],
            'hours_worked' => ['nullable', 'numeric', 'min:0'],
            'is_completed' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('is_completed', $data)) {
            $model->is_completed = (bool) $data['is_completed'];
            $model->completed_at = $model->is_completed ? now() : null;
        }
        $model->fill(collect($data)->except('is_completed')->all());
        $model->save();

        return response()->json(['data' => $model]);
    }

    public function uploadAttachment(Request $request, int $ticket, ConvertUploadedImageToWebp $toWebp): JsonResponse
    {
        $model = SdTicket::query()->findOrFail($ticket);
        $request->validate(['file' => ['required', 'file', 'max:10240']]);
        $file = $request->file('file');
        $converted = $toWebp->handle($file);

        $originalName = $file->getClientOriginalName();
        if ($converted['converted']) {
            $originalName = pathinfo($originalName, PATHINFO_FILENAME).'.webp';
        }

        $path = sprintf(
            'ticketing/%d/%s.%s',
            $model->id,
            Str::uuid()->toString(),
            $converted['extension'] !== '' ? $converted['extension'] : 'bin',
        );
        Storage::disk('local')->put($path, $converted['contents']);

        $attachment = SdTicketAttachment::query()->create([
            'ticket_id' => $model->id,
            'disk' => 'local',
            'path' => $path,
            'original_name' => $originalName,
            'mime' => $converted['mime'],
            'size' => strlen($converted['contents']),
            'uploaded_by' => $request->user()?->id,
        ]);

        return response()->json(['data' => $attachment], 201);
    }

    public function downloadAttachment(int $ticket, int $attachment): StreamedResponse
    {
        $model = SdTicketAttachment::query()->where('ticket_id', $ticket)->findOrFail($attachment);

        return Storage::disk($model->disk)->download($model->path, $model->original_name);
    }

    public function export(Request $request, ImportExportTickets $io): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ]);

        return response()->json(['data' => $io->export(array_map('intval', $data['ids']))]);
    }

    public function import(Request $request, ImportExportTickets $io, CreateTicket $create): JsonResponse
    {
        $data = $request->validate([
            'tickets' => ['required', 'array'],
        ]);

        $created = $io->import($data, $create, $request->user()?->id);

        return response()->json([
            'data' => $created->map(fn (SdTicket $t) => TicketingPayload::ticket($t))->values(),
        ], 201);
    }

    public function preferences(Request $request): JsonResponse
    {
        $prefs = SdUserPreference::query()->firstOrCreate(
            ['user_id' => $request->user()->id],
            ['email_send_delay_minutes' => 0, 'ticket_scope' => 'all'],
        );

        return response()->json(['data' => $prefs]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email_send_delay_minutes' => ['sometimes', 'integer', 'min:0', 'max:1440'],
            'default_desk_id' => ['sometimes', 'nullable', 'integer'],
            'default_filters' => ['sometimes', 'nullable', 'array'],
            'ticket_scope' => ['sometimes', 'string', 'in:all,assigned,own'],
        ]);

        $prefs = SdUserPreference::query()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data,
        );

        return response()->json(['data' => $prefs]);
    }
}
