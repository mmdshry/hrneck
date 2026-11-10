<?php

namespace App\Http\Controllers\Api\V1\Org\Ticketing;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Domains\Ticketing\Support\TicketNumberAllocator;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KbController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SdKbArticle::query()->latest();
        ListQuery::applySearch($query, $request, ['summary', 'description', 'number']);
        ListQuery::applyLikeFilters($query, $request, [
            'number' => 'number',
            'summary' => 'summary',
            'description' => 'description',
        ]);
        if ($request->has('published')) {
            $query->where('is_published', $request->boolean('published'));
        }

        $rows = $query->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (SdKbArticle $a) => TicketingPayload::kb($a))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, TicketNumberAllocator $numbers, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'summary' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer'],
            'is_published' => ['sometimes', 'boolean'],
            'desk_id' => ['nullable', 'integer'],
        ]);

        $desk = isset($data['desk_id'])
            ? SdDesk::query()->findOrFail((int) $data['desk_id'])
            : SdDesk::query()->where('type', 'kb')->firstOrFail();

        $article = SdKbArticle::query()->create([
            'desk_id' => $desk->id,
            'number' => $numbers->next($desk),
            'summary' => $data['summary'],
            'description' => $data['description'] ?? null,
            'category_id' => $data['category_id'] ?? null,
            'is_published' => (bool) ($data['is_published'] ?? false),
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        $audit->handle('ticketing', 'kb_created', 'KB article created', $article, [
            'number' => $article->number,
        ]);

        PublishLive::org([LiveTopics::KB]);

        return response()->json(['data' => TicketingPayload::kb($article)], 201);
    }

    public function show(int $article): JsonResponse
    {
        $model = SdKbArticle::query()->findOrFail($article);

        PublishLive::org([LiveTopics::KB]);

        return response()->json(['data' => TicketingPayload::kb($model)]);
    }

    public function update(Request $request, int $article, LogOrgActivity $audit): JsonResponse
    {
        $model = SdKbArticle::query()->findOrFail($article);
        $data = $request->validate([
            'summary' => ['sometimes', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer'],
            'is_published' => ['sometimes', 'boolean'],
        ]);
        $model->fill($data);
        $model->updated_by = $request->user()?->id;
        $model->save();

        $audit->handle('ticketing', 'kb_updated', 'KB article updated', $model, [
            'number' => $model->number,
        ]);

        PublishLive::org([LiveTopics::KB]);

        return response()->json(['data' => TicketingPayload::kb($model)]);
    }

    public function destroy(int $article, LogOrgActivity $audit): JsonResponse
    {
        $model = SdKbArticle::query()->findOrFail($article);
        $snapshot = ['id' => $model->id, 'number' => $model->number, 'summary' => $model->summary];
        $model->delete();

        $audit->handle('ticketing', 'kb_deleted', 'KB article deleted', null, [
            'article' => $snapshot,
        ]);

        return response()->json(['ok' => true]);
    }
}
