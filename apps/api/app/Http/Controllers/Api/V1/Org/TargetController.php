<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Checklists\Actions\AssignAutoChecklistPacks;
use App\Domains\IdentityAccess\Actions\ProvisionEmployeePair;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Actions\RecalculateTargetRisk;
use App\Domains\TargetsGroups\Models\Department;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\TargetProfileFields;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\AppLocale;
use App\Support\ListQuery;
use App\Support\MajorCities;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TargetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Target::query()->with(['groups', 'manager:id,email,first_name,last_name']);

        if (! $request->boolean('include_inactive') && ! $request->filled('status')) {
            $query->where('status', 'active');
        }

        ListQuery::applySearch($query, $request, [
            'email',
            'first_name',
            'last_name',
            'department',
            'job_title',
            'employee_number',
            'location',
            'phone',
        ]);
        ListQuery::applyLikeFilters($query, $request, [
            'email' => 'email',
            'name' => 'first_name',
            'first_name' => 'first_name',
            'last_name' => 'last_name',
            'department' => 'department',
            'job_title' => 'job_title',
            'employee_number' => 'employee_number',
            'location' => 'location',
            'phone' => 'phone',
        ]);
        ListQuery::applyExactFilters($query, $request, [
            'status' => 'status',
            'risk_score' => 'risk_score',
            'risk_tier' => 'risk_tier',
            'department_id' => 'department_id',
            'employment_type' => 'employment_type',
            'manager_target_id' => 'manager_target_id',
        ]);
        ListQuery::applySort($query, $request, [
            'email' => 'email',
            'department' => 'department',
            'status' => 'status',
            'risk_score' => 'risk_score',
            'risk_tier' => 'risk_tier',
            'job_title' => 'job_title',
            'hire_date' => 'hire_date',
            'employee_number' => 'employee_number',
        ], 'id', 'desc');

        $rows = $query->paginate(ApiPagination::perPage($request, max: 500));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function show(int $target): JsonResponse
    {
        $model = Target::query()
            ->with(['groups', 'manager:id,email,first_name,last_name'])
            ->findOrFail($target);

        return response()->json(['data' => $model]);
    }

    public function store(
        Request $request,
        LogOrgActivity $audit,
        AssignAutoChecklistPacks $autoAssign,
        ProvisionEmployeePair $provision,
        RecalculateTargetRisk $recalculateRisk,
    ): JsonResponse {
        $data = $request->validate($this->writeRules());
        $data = $this->normalizeWritableProfile($data);

        $departmentFields = $this->resolveDepartmentFields(
            array_key_exists('department_id', $data) ? $data['department_id'] : null,
            array_key_exists('department', $data) ? $data['department'] : null,
            array_key_exists('department_id', $data),
            array_key_exists('department', $data),
        );

        $tenantId = (string) tenant('id');
        $email = $provision->normalizeEmail($data['email']);
        $profile = $this->extractProfileAttributes($data);
        $this->assertManagerNotSelf(null, $profile['manager_target_id'] ?? null);

        $target = Target::query()->create(array_merge([
            'email' => $email,
            'first_name' => $data['first_name'] ?? null,
            'last_name' => $data['last_name'] ?? null,
            'department_id' => $departmentFields['department_id'],
            'department' => $departmentFields['department'],
            'status' => 'active',
            'joined_via' => 'manual',
        ], $profile));

        $target = $recalculateRisk->handle($target, force: true);

        $pair = $provision->ensureUserForTarget($target, $tenantId, queueInvite: true);

        $autoAssigned = $autoAssign->handle($target, $request->user()?->id);

        $audit->handle('targets', 'created', 'Target created', $target, [
            'email' => $target->email,
            'auto_assigned_instance_count' => $autoAssigned,
            'login_invited' => $pair['invited'],
        ]);

        $target->load(['groups', 'manager:id,email,first_name,last_name']);
        $this->publishTargetLive();

        return response()->json([
            'data' => $target,
            'meta' => [
                'auto_assigned_instance_count' => $autoAssigned,
                'login_invited' => $pair['invited'],
            ],
        ], 201);
    }

    public function update(
        Request $request,
        int $target,
        LogOrgActivity $audit,
        ProvisionEmployeePair $provision,
    ): JsonResponse {
        $target = Target::query()->findOrFail($target);
        $data = $request->validate($this->writeRules(forUpdate: true, targetId: $target->id, currentLocation: $target->location));
        $data = $this->normalizeWritableProfile($data);

        $before = $target->only([
            'email',
            'first_name',
            'last_name',
            'department',
            'department_id',
            'status',
            'job_title',
            'manager_target_id',
            'hire_date',
            'employee_number',
            'phone',
            'location',
            'employment_type',
            'risk_score',
            'risk_tier',
            'external_id',
        ]);
        $tenantId = (string) tenant('id');

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

        if (array_key_exists('email', $data)) {
            $data['email'] = $provision->normalizeEmail($data['email']);
            $provision->syncUserEmailFromTarget($tenantId, (string) $before['email'], $data['email']);
        }

        $profile = $this->extractProfileAttributes($data);
        $this->assertManagerNotSelf($target->id, $profile['manager_target_id'] ?? ($data['manager_target_id'] ?? $target->manager_target_id));

        unset(
            $data['joined_via'],
            $data['user_id'],
            $data['risk_source'],
            $data['risk_score'],
            $data['risk_tier'],
            $data['risk_updated_at'],
            $data['last_training_completed_at'],
        );

        $target->fill(array_merge($data, $profile))->save();

        if (array_key_exists('department_id', $data) || array_key_exists('department', $data)) {
            $provision->syncUserDepartmentFromTarget($target, $tenantId);
        }

        if (($data['status'] ?? null) === 'inactive' && $before['status'] !== 'inactive') {
            $provision->onTargetDeactivated($target, $tenantId);
        }

        if (($data['status'] ?? null) === 'active' && $before['status'] !== 'active') {
            $provision->ensureUserForTarget($target, $tenantId, queueInvite: false);
        }

        $event = ($data['status'] ?? null) === 'inactive' && $before['status'] !== 'inactive'
            ? 'archived'
            : 'updated';

        $audit->handle('targets', $event, 'Target '.$event, $target, [
            'before' => $before,
            'after' => $target->only(array_keys($before)),
        ]);

        $target->load(['groups', 'manager:id,email,first_name,last_name']);
        $this->publishTargetLive();

        return response()->json([
            'data' => $target,
        ]);
    }

    public function destroy(
        int $target,
        LogOrgActivity $audit,
        ProvisionEmployeePair $provision,
    ): JsonResponse {
        $target = Target::query()->findOrFail($target);
        $snapshot = $target->only(['id', 'email', 'status', 'user_id']);
        $tenantId = (string) tenant('id');
        $target->groups()->detach();
        $target->delete();
        $provision->onTargetDeleted((string) $snapshot['email'], $tenantId);

        $audit->handle('targets', 'deleted', 'Target deleted', null, [
            'target' => $snapshot,
        ]);

        $this->publishTargetLive();

        return response()->json(['message' => 'Deleted']);
    }

    public function recalculateRisk(
        int $target,
        RecalculateTargetRisk $recalculate,
        LogOrgActivity $audit,
    ): JsonResponse {
        $target = Target::query()->findOrFail($target);
        $updated = $recalculate->handle($target, force: true);

        $audit->handle('targets', 'risk_recalculated', 'Target risk recalculated', $updated, [
            'risk_score' => $updated->risk_score,
            'risk_tier' => $updated->risk_tier,
            'risk_source' => $updated->risk_source,
        ]);

        $updated->load(['groups', 'manager:id,email,first_name,last_name']);
        $this->publishTargetLive();

        return response()->json(['data' => $updated]);
    }

    /**
     * @return array<string, mixed>
     */
    private function writeRules(bool $forUpdate = false, ?int $targetId = null, ?string $currentLocation = null): array
    {
        $optional = $forUpdate ? ['sometimes'] : [];

        return [
            'email' => array_merge($optional, [
                $forUpdate ? 'filled' : 'required',
                'email',
                Rule::unique('targets', 'email')->ignore($targetId),
            ]),
            'first_name' => array_merge($optional, ['nullable', 'string', 'max:120']),
            'last_name' => array_merge($optional, ['nullable', 'string', 'max:120']),
            'department_id' => array_merge($optional, [
                'nullable',
                'integer',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    if (! Department::query()->whereKey((int) $value)->exists()) {
                        $fail('The selected department is invalid.');
                    }
                },
            ]),
            'department' => array_merge($optional, ['nullable', 'string', 'max:120']),
            'status' => array_merge($optional, ['string', Rule::in(['active', 'inactive'])]),
            'job_title' => array_merge($optional, ['nullable', 'string', 'max:120']),
            'manager_target_id' => array_merge($optional, [
                'nullable',
                'integer',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    if (! Target::query()->whereKey((int) $value)->exists()) {
                        $fail('The selected manager is invalid.');
                    }
                },
            ]),
            'hire_date' => array_merge($optional, ['nullable', 'date']),
            'employee_number' => array_merge($optional, [
                'nullable',
                'string',
                'max:120',
                Rule::unique('targets', 'employee_number')->ignore($targetId),
            ]),
            'phone' => array_merge($optional, ['nullable', 'string', 'max:40']),
            'location' => array_merge($optional, [
                'nullable',
                'string',
                'max:120',
                function (string $attribute, mixed $value, \Closure $fail) use ($currentLocation): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    if (! is_string($value)) {
                        $fail('The selected location is invalid.');

                        return;
                    }
                    if (MajorCities::isValid($value)) {
                        return;
                    }
                    if ($currentLocation !== null && $value === $currentLocation) {
                        return;
                    }
                    $fail('The selected location is invalid. Use Country/City (e.g. Iran/Tehran).');
                },
            ]),
            'employment_type' => array_merge($optional, [
                'nullable',
                'string',
                Rule::in(TargetProfileFields::EMPLOYMENT_TYPES),
            ]),
            'preferred_language' => array_merge($optional, ['nullable', 'string', 'max:16']),
            'timezone' => array_merge($optional, [
                $forUpdate ? 'filled' : 'required',
                'string',
                'max:64',
                'timezone:all',
            ]),
            'external_id' => array_merge($optional, ['nullable', 'string', 'max:120']),
            'notification_opt_out' => array_merge($optional, ['boolean']),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeWritableProfile(array $data): array
    {
        if (array_key_exists('preferred_language', $data)) {
            $raw = $data['preferred_language'];
            if ($raw === null || (is_string($raw) && trim($raw) === '')) {
                $data['preferred_language'] = null;
            } else {
                $data['preferred_language'] = AppLocale::normalize(is_string($raw) ? $raw : null);
            }
        }

        unset($data['risk_score'], $data['risk_tier'], $data['risk_source'], $data['risk_updated_at']);

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function extractProfileAttributes(array $data): array
    {
        $out = [];
        foreach (TargetProfileFields::profileAttributeKeys() as $key) {
            if (array_key_exists($key, $data)) {
                $out[$key] = $data[$key];
            }
        }

        return $out;
    }

    private function assertManagerNotSelf(?int $targetId, mixed $managerTargetId): void
    {
        if ($managerTargetId === null || $managerTargetId === '') {
            return;
        }

        if ($targetId !== null && (int) $managerTargetId === (int) $targetId) {
            throw ValidationException::withMessages([
                'manager_target_id' => ['An employee cannot be their own manager.'],
            ]);
        }
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

    private function publishTargetLive(): void
    {
        PublishLive::metricsBundle();
        PublishLive::org([
            LiveTopics::TARGETS,
            LiveTopics::DEPARTMENTS,
            LiveTopics::CHECKLIST_INSTANCES,
        ]);
    }
}
