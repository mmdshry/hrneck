<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Target;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TargetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Target::query()->with('groups')->latest();

        if (! $request->boolean('include_inactive')) {
            $query->where('status', 'active');
        }

        $rows = $query->paginate(ApiPagination::perPage($request, max: 500));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'unique:targets,email'],
            'first_name' => ['nullable', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'department' => ['nullable', 'string', 'max:120'],
        ]);

        $target = Target::query()->create($data + ['status' => 'active']);

        $audit->handle('targets', 'created', 'Target created', $target, [
            'email' => $target->email,
        ]);

        PublishLive::org([LiveTopics::TRAINING_CAMPAIGNS]);

        return response()->json(['data' => $target], 201);
    }

    public function update(Request $request, Target $target, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'email' => ['sometimes', 'email', 'unique:targets,email,'.$target->id],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'department' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'string', 'in:active,inactive'],
        ]);

        $before = $target->only(['email', 'first_name', 'last_name', 'department', 'status']);
        $target->fill($data)->save();

        $event = ($data['status'] ?? null) === 'inactive' && $before['status'] !== 'inactive'
            ? 'archived'
            : 'updated';

        $audit->handle('targets', $event, 'Target '.$event, $target, [
            'before' => $before,
            'after' => $target->only(['email', 'first_name', 'last_name', 'department', 'status']),
        ]);

        PublishLive::org([LiveTopics::TRAINING_CAMPAIGNS]);

        return response()->json(['data' => $target->load('groups')]);
    }

    public function destroy(Target $target, LogOrgActivity $audit): JsonResponse
    {
        $snapshot = $target->only(['id', 'email', 'status']);
        $target->groups()->detach();
        $target->delete();

        $audit->handle('targets', 'deleted', 'Target deleted', null, [
            'target' => $snapshot,
        ]);

        PublishLive::org([LiveTopics::TRAINING_CAMPAIGNS]);

        return response()->json(['message' => 'Deleted']);
    }

    public function importCsv(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt']]);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($handle) ?: [];
        $created = 0;
        while (($row = fgetcsv($handle)) !== false) {
            if (count($header) !== count($row)) {
                continue;
            }
            $item = array_combine($header, $row);
            if (empty($item['email'])) {
                continue;
            }
            Target::query()->updateOrCreate(
                ['email' => trim((string) $item['email'])],
                [
                    'first_name' => $item['first_name'] ?? null,
                    'last_name' => $item['last_name'] ?? null,
                    'department' => $item['department'] ?? null,
                    'status' => 'active',
                ],
            );
            $created++;
        }
        fclose($handle);

        $audit->handle('targets', 'imported', 'Targets CSV imported', null, [
            'imported' => $created,
        ]);

        PublishLive::org([LiveTopics::TRAINING_CAMPAIGNS]);

        return response()->json(['imported' => $created]);
    }
}
