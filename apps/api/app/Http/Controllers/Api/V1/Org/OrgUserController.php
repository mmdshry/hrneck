<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\EnsureTenantMembership;
use App\Domains\IdentityAccess\Actions\ProvisionEmployeePair;
use App\Domains\IdentityAccess\Actions\SyncOrgUserRoles;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\ResolveActiveTarget;
use App\Domains\TargetsGroups\Support\ResolveDepartmentFields;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class OrgUserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = (string) tenant('id');

        $query = User::query()
            ->inTenant($tenantId)
            ->whereNull('disabled_at')
            ->with(['roles', 'memberships']);
        ListQuery::applySearch($query, $request, ['name', 'email']);
        ListQuery::applyLikeFilters($query, $request, [
            'name' => 'name',
            'email' => 'email',
        ]);
        if ($request->filled('role')) {
            $role = trim((string) $request->input('role'));
            $query->whereHas('roles', fn ($q) => $q->where('name', 'like', ListQuery::likePattern($role)));
        }
        ListQuery::applySort($query, $request, [
            'name' => 'name',
            'email' => 'email',
        ], 'name', 'asc');

        $users = $query->paginate(ApiPagination::perPage($request));
        app(ResolveActiveTarget::class)->attachLinkedTargets($users->getCollection());

        return UserResource::collection($users);
    }

    public function store(Request $request, CreateOrgUser $createOrgUser, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', Password::defaults()],
            'roles' => ['sometimes', 'array'],
            'roles.*' => ['string', 'max:80'],
            'department_id' => ['sometimes', 'nullable', 'integer', Rule::exists('departments', 'id')],
        ]);

        $user = $createOrgUser->handle(
            (string) tenant('id'),
            $data['name'],
            $data['email'],
            $data['password'],
            $data['roles'] ?? ['org_admin'],
            array_key_exists('department_id', $data) ? $data['department_id'] : null,
            array_key_exists('department_id', $data),
        );

        $audit->handle('users', 'created', 'Org user created', $user, [
            'email' => $user->email,
            'roles' => $data['roles'] ?? ['org_admin'],
            'department_id' => $user->membershipFor((string) tenant('id'))->department_id ?? $user->department_id,
        ]);

        PublishLive::org([LiveTopics::USERS, LiveTopics::REPORTS_DETAILED]);

        return response()->json(['data' => new UserResource($user)], 201);
    }

    public function update(
        Request $request,
        User $user,
        LogOrgActivity $audit,
        ResolveDepartmentFields $resolveDepartment,
        EnsureTenantMembership $memberships,
    ): UserResource {
        $tenantId = (string) tenant('id');
        if (! $user->belongsToTenant($tenantId, activeOnly: false)) {
            abort(404);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => [
                'sometimes',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'department_id' => ['sometimes', 'nullable', 'integer', Rule::exists('departments', 'id')],
        ]);

        $membership = $user->membershipFor($tenantId);
        $before = [
            'name' => $user->name,
            'email' => $user->email,
            'department_id' => $membership?->department_id,
            'department' => $membership?->department,
        ];

        $departmentFields = null;
        if (array_key_exists('department_id', $data)) {
            $departmentFields = $resolveDepartment->fromId($data['department_id']);
            unset($data['department_id']);
        }

        if ($data !== []) {
            $user->fill($data)->save();
        }

        if ($departmentFields !== null) {
            $memberships->handle($user, $tenantId, $departmentFields);
        }

        $user->refresh()->load(['roles', 'memberships']);
        $afterMembership = $user->membershipFor($tenantId);

        $audit->handle('users', 'updated', 'Org user updated', $user, [
            'before' => $before,
            'after' => [
                'name' => $user->name,
                'email' => $user->email,
                'department_id' => $afterMembership?->department_id,
                'department' => $afterMembership?->department,
            ],
        ]);

        PublishLive::org([LiveTopics::USERS, LiveTopics::REPORTS_DETAILED]);

        return new UserResource($user);
    }

    public function syncRoles(Request $request, User $user, SyncOrgUserRoles $syncOrgUserRoles, LogOrgActivity $audit): UserResource
    {
        $data = $request->validate([
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string', 'max:80'],
        ]);

        $before = $user->roles->pluck('name')->all();
        $updated = $syncOrgUserRoles->handle($user, (string) tenant('id'), $data['roles']);

        $audit->handle('users', 'roles_synced', 'Org user roles updated', $updated, [
            'before' => $before,
            'after' => $data['roles'],
        ]);

        PublishLive::org([LiveTopics::USERS]);

        return new UserResource($updated);
    }

    public function destroy(User $user, LogOrgActivity $audit, ProvisionEmployeePair $provision): JsonResponse
    {
        $tenantId = (string) tenant('id');
        if (! $user->belongsToTenant($tenantId, activeOnly: false)) {
            abort(404);
        }

        if ($user->id === auth()->id()) {
            abort(422, 'You cannot delete your own account.');
        }

        $snapshot = ['id' => $user->id, 'email' => $user->email, 'name' => $user->name];
        Target::query()->where('user_id', $user->id)->each(function (Target $target): void {
            if ($target->joined_via === 'learner_role') {
                $target->groups()->detach();
                $target->delete();

                return;
            }

            $target->forceFill(['user_id' => null])->save();
        });

        $hadOtherMemberships = $user->memberships()
            ->where('tenant_id', '!=', $tenantId)
            ->exists();

        $provision->removeMembershipKeepingOthers($user, $tenantId);

        if (! $hadOtherMemberships) {
            $user->delete();
        }

        $audit->handle('users', 'deleted', 'Org user deleted', null, [
            'user' => $snapshot,
            'tenant_id' => $tenantId,
            'removed_globally' => ! $hadOtherMemberships,
        ]);

        PublishLive::org([LiveTopics::USERS]);
        PublishLive::metricsBundle();

        return response()->json(['message' => 'Deleted']);
    }
}
