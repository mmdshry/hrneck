<?php

namespace App\Http\Controllers\Api\V1\Portal;

use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Support\ResolveActiveTarget;
use App\Domains\Ticketing\Actions\CreateTicket;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketNote;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PortalTicketingController extends Controller
{
    public function __construct(private readonly ResolveActiveTarget $targets) {}

    public function desks(Request $request): JsonResponse
    {
        $this->targets->assertEmployeeAccessAllowed($request->user());

        $desks = SdDesk::query()
            ->where('is_active', true)
            ->whereIn('type', ['incident', 'service_request'])
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'type']);

        return response()->json(['data' => $desks]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->targets->assertEmployeeAccessAllowed($request->user());

        $userId = $request->user()?->id;
        $targetId = $this->targets->idForUser($request->user());

        $query = SdTicket::query()
            ->with(['desk', 'stage', 'status', 'priority'])
            ->active()
            ->where(function ($q) use ($userId, $targetId): void {
                $q->where('requester_user_id', $userId);
                if ($targetId) {
                    $q->orWhere('requester_target_id', $targetId);
                }
            });

        ListQuery::applySearch($query, $request, ['summary', 'number']);
        ListQuery::applyLikeFilters($query, $request, [
            'number' => 'number',
            'summary' => 'summary',
        ]);
        if ($request->filled('stage')) {
            $stage = trim((string) $request->input('stage'));
            $query->whereHas('stage', fn ($q) => $q->where('name', 'like', ListQuery::likePattern($stage)));
        }
        if ($request->filled('status')) {
            $status = trim((string) $request->input('status'));
            $query->whereHas('status', fn ($q) => $q->where('name', 'like', ListQuery::likePattern($status)));
        }

        $rows = $query->latest()->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (SdTicket $t) => TicketingPayload::ticket($t))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, CreateTicket $action): JsonResponse
    {
        $this->targets->assertEmployeeAccessAllowed($request->user());

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

        $targetId = $this->targets->idForUser($request->user());

        $ticket = $action->handle([
            ...$data,
            'requester_user_id' => $request->user()?->id,
            'requester_target_id' => $targetId,
        ], $request->user()?->id);

        return response()->json(['data' => TicketingPayload::ticket($ticket, detailed: true)], 201);
    }

    public function show(Request $request, int $ticket): JsonResponse
    {
        $this->targets->assertEmployeeAccessAllowed($request->user());

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
        $this->targets->assertEmployeeAccessAllowed($request->user());

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

        PublishLive::org([LiveTopics::TICKETS], throttled: true);
        if ($model->requester_user_id) {
            PublishLive::portalUser((int) $model->requester_user_id);
        } elseif ($request->user()?->id) {
            PublishLive::portalUser((int) $request->user()->id);
        }

        return response()->json(['data' => $note], 201);
    }

    public function kb(Request $request): JsonResponse
    {
        $this->targets->assertEmployeeAccessAllowed($request->user());

        $query = SdKbArticle::query()->where('is_published', true)->latest();
        ListQuery::applySearch($query, $request, ['summary', 'description', 'number']);
        ListQuery::applyLikeFilters($query, $request, [
            'number' => 'number',
            'summary' => 'summary',
            'description' => 'description',
        ]);

        $rows = $query->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (SdKbArticle $a) => TicketingPayload::kb($a))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    private function ownedTicket(Request $request, int $ticketId): SdTicket
    {
        $userId = $request->user()?->id;
        $targetId = $this->targets->idForUser($request->user());

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
