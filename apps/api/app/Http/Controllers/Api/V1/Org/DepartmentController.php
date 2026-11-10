<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Department;
use App\Domains\TargetsGroups\Models\Target;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Department::query()->withCount('targets');

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        ListQuery::applySearch($query, $request, ['name']);
        ListQuery::applyLikeFilters($query, $request, [
            'name' => 'name',
        ]);
        ListQuery::applyBooleanFilters($query, $request, [
            'is_active' => 'is_active',
        ]);
        ListQuery::applySort($query, $request, [
            'name' => 'name',
            'is_active' => 'is_active',
            'targets_count' => 'targets_count',
        ], 'name', 'asc');

        $rows = $query->paginate(ApiPagination::perPage($request, max: 500));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function store(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', 'unique:departments,name'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $department = Department::query()->create([
            'name' => trim($data['name']),
            'is_active' => $data['is_active'] ?? true,
        ]);

        $audit->handle('departments', 'created', 'Department created', $department, [
            'name' => $department->name,
        ]);

        $this->publishLive();

        return response()->json(['data' => $department->loadCount('targets')], 201);
    }

    public function update(Request $request, Department $department, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:120',
                Rule::unique('departments', 'name')->ignore($department->id),
            ],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $before = $department->only(['name', 'is_active']);

        if (array_key_exists('name', $data)) {
            $data['name'] = trim($data['name']);
        }

        $department->fill($data)->save();

        if (array_key_exists('name', $data) && $before['name'] !== $department->name) {
            Target::query()
                ->where('department_id', $department->id)
                ->update(['department' => $department->name]);
        }

        $audit->handle('departments', 'updated', 'Department updated', $department, [
            'before' => $before,
            'after' => $department->only(['name', 'is_active']),
        ]);

        $this->publishLive();

        return response()->json(['data' => $department->loadCount('targets')]);
    }

    public function destroy(Department $department, LogOrgActivity $audit): JsonResponse
    {
        $assigned = $department->targets()->count();
        if ($assigned > 0) {
            return response()->json([
                'message' => 'Cannot delete a department that still has employees assigned.',
                'assigned' => $assigned,
            ], 422);
        }

        $snapshot = ['id' => $department->id, 'name' => $department->name];
        $department->delete();

        $audit->handle('departments', 'deleted', 'Department deleted', null, [
            'department' => $snapshot,
        ]);

        $this->publishLive();

        return response()->json(['message' => 'Deleted']);
    }

    private function publishLive(): void
    {
        PublishLive::org([
            LiveTopics::DEPARTMENTS,
            LiveTopics::TARGETS,
            LiveTopics::REPORTS_DETAILED,
        ]);
    }
}
