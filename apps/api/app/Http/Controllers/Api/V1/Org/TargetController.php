<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Checklists\Actions\AssignAutoChecklistPacks;
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

class TargetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Target::query()->with('groups');

        if (! $request->boolean('include_inactive') && ! $request->filled('status')) {
            $query->where('status', 'active');
        }

        ListQuery::applySearch($query, $request, ['email', 'first_name', 'last_name', 'department']);
        ListQuery::applyLikeFilters($query, $request, [
            'email' => 'email',
            'name' => 'first_name',
            'first_name' => 'first_name',
            'last_name' => 'last_name',
            'department' => 'department',
        ]);
        ListQuery::applyExactFilters($query, $request, [
            'status' => 'status',
            'risk_score' => 'risk_score',
            'department_id' => 'department_id',
        ]);
        ListQuery::applySort($query, $request, [
            'email' => 'email',
            'department' => 'department',
            'status' => 'status',
            'risk_score' => 'risk_score',
        ], 'id', 'desc');

        $rows = $query->paginate(ApiPagination::perPage($request, max: 500));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function show(int $target): JsonResponse
    {
        $model = Target::query()->with('groups')->findOrFail($target);

        return response()->json(['data' => $model]);
    }

    public function store(Request $request, LogOrgActivity $audit, AssignAutoChecklistPacks $autoAssign): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'unique:targets,email'],
            'first_name' => ['nullable', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'department' => ['nullable', 'string', 'max:120'],
        ]);

        $departmentFields = $this->resolveDepartmentFields(
            array_key_exists('department_id', $data) ? $data['department_id'] : null,
            array_key_exists('department', $data) ? $data['department'] : null,
            array_key_exists('department_id', $data),
            array_key_exists('department', $data),
        );

        $target = Target::query()->create([
            'email' => $data['email'],
            'first_name' => $data['first_name'] ?? null,
            'last_name' => $data['last_name'] ?? null,
            'department_id' => $departmentFields['department_id'],
            'department' => $departmentFields['department'],
            'status' => 'active',
        ]);

        $autoAssigned = $autoAssign->handle($target, $request->user()?->id);

        $audit->handle('targets', 'created', 'Target created', $target, [
            'email' => $target->email,
            'auto_assigned_instance_count' => $autoAssigned,
        ]);

        PublishLive::org([
            LiveTopics::TARGETS,
            LiveTopics::DEPARTMENTS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::CHECKLIST_INSTANCES,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return response()->json([
            'data' => $target,
            'meta' => [
                'auto_assigned_instance_count' => $autoAssigned,
            ],
        ], 201);
    }

    public function update(Request $request, Target $target, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'email' => ['sometimes', 'email', 'unique:targets,email,'.$target->id],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'department' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'string', Rule::in(['active', 'inactive'])],
        ]);

        $before = $target->only(['email', 'first_name', 'last_name', 'department', 'department_id', 'status']);

        if (array_key_exists('department_id', $data) || array_key_exists('department', $data)) {
            $departmentFields = $this->resolveDepartmentFields(
                array_key_exists('department_id', $data) ? $data['department_id'] : null,
                array_key_exists('department', $data) ? $data['department'] : null,
                array_key_exists('department_id', $data),
                array_key_exists('department', $data),
            );
            $data['department_id'] = $departmentFields['department_id'];
            $data['department'] = $departmentFields['department'];
        }

        $target->fill($data)->save();

        $event = ($data['status'] ?? null) === 'inactive' && $before['status'] !== 'inactive'
            ? 'archived'
            : 'updated';

        $audit->handle('targets', $event, 'Target '.$event, $target, [
            'before' => $before,
            'after' => $target->only(['email', 'first_name', 'last_name', 'department', 'department_id', 'status']),
        ]);

        PublishLive::org([
            LiveTopics::TARGETS,
            LiveTopics::DEPARTMENTS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::REPORTS_DETAILED,
        ]);

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

        PublishLive::org([
            LiveTopics::TARGETS,
            LiveTopics::DEPARTMENTS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return response()->json(['message' => 'Deleted']);
    }

    public function importCsv(Request $request, LogOrgActivity $audit, AssignAutoChecklistPacks $autoAssign): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt']]);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($handle) ?: [];
        $created = 0;
        $autoAssigned = 0;
        while (($row = fgetcsv($handle)) !== false) {
            if (count($header) !== count($row)) {
                continue;
            }
            $item = array_combine($header, $row);
            if (empty($item['email'])) {
                continue;
            }

            $departmentFields = $this->resolveDepartmentFields(
                null,
                isset($item['department']) ? (string) $item['department'] : null,
                false,
                true,
            );

            $email = trim((string) $item['email']);
            $target = Target::query()->firstOrNew(['email' => $email]);
            $isNew = ! $target->exists;
            $target->fill([
                'first_name' => $item['first_name'] ?? null,
                'last_name' => $item['last_name'] ?? null,
                'department_id' => $departmentFields['department_id'],
                'department' => $departmentFields['department'],
                'status' => 'active',
            ]);
            $target->save();
            $created++;

            if ($isNew) {
                $autoAssigned += $autoAssign->handle($target, $request->user()?->id);
            }
        }
        fclose($handle);

        $audit->handle('targets', 'imported', 'Targets CSV imported', null, [
            'imported' => $created,
            'auto_assigned_instance_count' => $autoAssigned,
        ]);

        PublishLive::org([
            LiveTopics::TARGETS,
            LiveTopics::DEPARTMENTS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::CHECKLIST_INSTANCES,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return response()->json([
            'imported' => $created,
            'meta' => [
                'auto_assigned_instance_count' => $autoAssigned,
            ],
        ]);
    }

    /**
     * @return array{department_id: int|null, department: string|null}
     */
    private function resolveDepartmentFields(
        mixed $departmentId,
        mixed $departmentName,
        bool $hasDepartmentId,
        bool $hasDepartmentName,
    ): array {
        if ($hasDepartmentId) {
            if ($departmentId === null || $departmentId === '') {
                return ['department_id' => null, 'department' => null];
            }

            $department = Department::query()->find((int) $departmentId);
            if ($department === null) {
                return ['department_id' => null, 'department' => null];
            }

            return [
                'department_id' => $department->id,
                'department' => $department->name,
            ];
        }

        if (! $hasDepartmentName) {
            return ['department_id' => null, 'department' => null];
        }

        $trimmed = trim((string) ($departmentName ?? ''));
        if ($trimmed === '') {
            return ['department_id' => null, 'department' => null];
        }

        $department = Department::query()->firstOrCreate(
            ['name' => mb_substr($trimmed, 0, 120)],
            ['is_active' => true],
        );

        return [
            'department_id' => $department->id,
            'department' => $department->name,
        ];
    }
}
