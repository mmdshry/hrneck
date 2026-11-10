<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Group;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Group::query()
            ->with(['targets:id'])
            ->withCount('targets');

        if (! $request->boolean('include_inactive') && ! $request->filled('status')) {
            $query->where('status', 'active');
        }

        ListQuery::applySearch($query, $request, ['name']);
        ListQuery::applyLikeFilters($query, $request, [
            'name' => 'name',
            'source' => 'source',
        ]);
        ListQuery::applyExactFilters($query, $request, [
            'status' => 'status',
        ]);
        ListQuery::applySort($query, $request, [
            'name' => 'name',
            'targets_count' => 'targets_count',
            'status' => 'status',
        ], 'id', 'desc');

        $rows = $query->paginate(ApiPagination::perPage($request, max: 500));

        return response()->json([
            'data' => collect($rows->items())->map(static function (Group $group): array {
                $payload = $group->makeHidden('targets')->toArray();
                $payload['target_ids'] = $group->targets
                    ->pluck('id')
                    ->map(static fn ($id) => (int) $id)
                    ->values()
                    ->all();

                return $payload;
            })->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'target_ids' => ['array'],
            'target_ids.*' => ['integer'],
        ]);

        $group = Group::query()->create([
            'name' => $data['name'],
            'status' => 'active',
            'source' => 'manual',
        ]);
        $group->targets()->sync($data['target_ids'] ?? []);

        $audit->handle('groups', 'created', 'Group created', $group, [
            'name' => $group->name,
            'target_ids' => $data['target_ids'] ?? [],
        ]);

        PublishLive::org([
            LiveTopics::GROUPS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return response()->json(['data' => $group->load('targets')], 201);
    }

    public function update(Request $request, Group $group, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'status' => ['sometimes', 'string', Rule::in(['active', 'inactive'])],
            'target_ids' => ['sometimes', 'array'],
            'target_ids.*' => ['integer'],
        ]);

        $before = [
            'name' => $group->name,
            'status' => $group->status,
            'target_ids' => $group->targets()->pluck('id')->all(),
        ];

        if (array_key_exists('name', $data)) {
            $group->name = $data['name'];
        }

        if (array_key_exists('status', $data)) {
            $group->status = $data['status'];
        }

        if ($group->isDirty()) {
            $group->save();
        }

        if (array_key_exists('target_ids', $data)) {
            $group->targets()->sync($data['target_ids']);
        }

        $event = ($data['status'] ?? null) === 'inactive' && $before['status'] !== 'inactive'
            ? 'archived'
            : 'updated';

        $audit->handle('groups', $event, 'Group '.$event, $group, [
            'before' => $before,
            'after' => [
                'name' => $group->name,
                'status' => $group->status,
                'target_ids' => $group->targets()->pluck('id')->all(),
            ],
        ]);

        PublishLive::org([
            LiveTopics::GROUPS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return response()->json(['data' => $group->load('targets')->loadCount('targets')]);
    }

    public function destroy(Request $request, Group $group, LogOrgActivity $audit): JsonResponse
    {
        if ($request->boolean('force')) {
            $snapshot = ['id' => $group->id, 'name' => $group->name, 'status' => $group->status];
            $group->targets()->detach();
            $group->delete();

            $audit->handle('groups', 'deleted', 'Group deleted', null, [
                'group' => $snapshot,
            ]);

            PublishLive::org([
                LiveTopics::GROUPS,
                LiveTopics::TRAINING_CAMPAIGNS,
                LiveTopics::TRAINING,
                LiveTopics::REPORTS_DETAILED,
            ]);

            return response()->json(['message' => 'Deleted']);
        }

        $before = ['status' => $group->status];
        $group->status = 'inactive';
        $group->save();

        $audit->handle('groups', 'archived', 'Group archived', $group, [
            'before' => $before,
            'after' => ['status' => $group->status],
        ]);

        PublishLive::org([
            LiveTopics::GROUPS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return response()->json(['data' => $group->load('targets')->loadCount('targets')]);
    }
}
