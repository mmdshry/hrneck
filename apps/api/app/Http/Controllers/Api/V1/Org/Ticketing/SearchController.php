<?php

namespace App\Http\Controllers\Api\V1\Org\Ticketing;

use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        $perPage = ApiPagination::perPage($request);
        if ($q === '') {
            return response()->json([
                'data' => ['tickets' => [], 'kb' => []],
                'meta' => [
                    'tickets' => [
                        'current_page' => 1,
                        'last_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                    ],
                    'kb' => [
                        'current_page' => 1,
                        'last_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                    ],
                ],
            ]);
        }

        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $q).'%';

        $tickets = SdTicket::query()
            ->with(['desk', 'stage', 'priority'])
            ->active()
            ->where(function ($b) use ($like): void {
                $b->where('summary', 'like', $like)
                    ->orWhere('number', 'like', $like)
                    ->orWhere('description', 'like', $like);
            })
            ->latest()
            ->paginate($perPage, ['*'], 'tickets_page');

        $kb = SdKbArticle::query()
            ->where(function ($b) use ($like): void {
                $b->where('summary', 'like', $like)
                    ->orWhere('number', 'like', $like)
                    ->orWhere('description', 'like', $like);
            })
            ->latest()
            ->paginate($perPage, ['*'], 'kb_page');

        return response()->json([
            'data' => [
                'tickets' => collect($tickets->items())->map(fn (SdTicket $t) => TicketingPayload::ticket($t))->values(),
                'kb' => collect($kb->items())->map(fn (SdKbArticle $a) => TicketingPayload::kb($a))->values(),
            ],
            'meta' => [
                'tickets' => ApiPagination::meta($tickets),
                'kb' => ApiPagination::meta($kb),
            ],
        ]);
    }
}
