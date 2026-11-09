<?php

namespace App\Http\Controllers\Api\V1\Portal;

use App\Domains\TargetsGroups\Models\Target;
use App\Domains\Ticketing\Actions\CreateTicket;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketNote;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PortalTicketingController extends Controller
{
    public function desks(): JsonResponse
    {
        $desks = SdDesk::query()
            ->where('is_active', true)
            ->whereIn('type', ['incident', 'service_request'])
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'type']);

        return response()->json(['data' => $desks]);
    }

    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()?->id;
        $targetId = Target::query()->where('email', $request->user()?->email)->value('id');

        $query = SdTicket::query()
            ->with(['desk', 'stage', 'status', 'priority'])
            ->active()
            ->where(function ($q) use ($userId, $targetId): void {
                $q->where('requester_user_id', $userId);
                if ($targetId) {
                    $q->orWhere('requester_target_id', $targetId);
                }
            });

        $rows = $query->latest()->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (SdTicket $t) => TicketingPayload::ticket($t))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, CreateTicket $action): JsonResponse
    {
        $data = $request->validate([
            'desk_id' => ['required', 'integer'],
            'summary' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'priority_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
        ]);

        $desk = SdDesk::query()->whereKey((int) $data['desk_id'])->where('is_active', true)->firstOrFail();
        if (! in_array($desk->type, ['incident', 'service_request'], true)) {
            abort(422, 'Portal tickets are limited to incident and service request desks.');
        }

        $targetId = Target::query()->where('email', $request->user()?->email)->value('id');

        $ticket = $action->handle([
            ...$data,
            'requester_user_id' => $request->user()?->id,
            'requester_target_id' => $targetId,
        ], $request->user()?->id);

        return response()->json(['data' => TicketingPayload::ticket($ticket, detailed: true)], 201);
    }

    public function show(Request $request, int $ticket): JsonResponse
    {
        $model = $this->ownedTicket($request, $ticket)
            ->load(['desk', 'stage', 'status', 'priority', 'notes' => fn ($q) => $q->where('is_public', true)]);

        $payload = TicketingPayload::ticket($model, detailed: true);
        $payload['notes'] = $model->notes->map(fn ($n) => [
            'id' => $n->id,
            'body' => $n->body,
            'is_public' => $n->is_public,
            'created_at' => optional($n->created_at)?->toIso8601String(),
        ])->values();

        return response()->json(['data' => $payload]);
    }

    public function addNote(Request $request, int $ticket): JsonResponse
    {
        $model = $this->ownedTicket($request, $ticket);
        $data = $request->validate([
            'body' => ['required', 'string'],
        ]);

        $note = SdTicketNote::query()->create([
            'ticket_id' => $model->id,
            'body' => $data['body'],
            'is_public' => true,
            'author_user_id' => $request->user()?->id,
        ]);

        return response()->json(['data' => $note], 201);
    }

    public function kb(Request $request): JsonResponse
    {
        $query = SdKbArticle::query()->where('is_published', true)->latest();
        if ($request->filled('q')) {
            $q = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->input('q')).'%';
            $query->where(function ($b) use ($q): void {
                $b->where('summary', 'like', $q)->orWhere('description', 'like', $q);
            });
        }

        $rows = $query->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (SdKbArticle $a) => TicketingPayload::kb($a))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    private function ownedTicket(Request $request, int $ticketId): SdTicket
    {
        $userId = $request->user()?->id;
        $targetId = Target::query()->where('email', $request->user()?->email)->value('id');

        return SdTicket::query()
            ->active()
            ->whereKey($ticketId)
            ->where(function ($q) use ($userId, $targetId): void {
                $q->where('requester_user_id', $userId);
                if ($targetId) {
                    $q->orWhere('requester_target_id', $targetId);
                }
            })
            ->firstOrFail();
    }
}
