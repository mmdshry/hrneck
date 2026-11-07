<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Actions\CreateOrgUser;
use App\Domains\IdentityAccess\Actions\SyncOrgUserRoles;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class OrgUserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = (string) tenant('id');

        $users = User::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->paginate(ApiPagination::perPage($request));

        return UserResource::collection($users);
    }

    public function store(Request $request, CreateOrgUser $createOrgUser, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['sometimes', 'array'],
            'roles.*' => ['string', 'max:80'],
        ]);

        $user = $createOrgUser->handle(
            (string) tenant('id'),
            $data['name'],
            $data['email'],
            $data['password'],
            $data['roles'] ?? ['org_admin'],
        );

        $audit->handle('users', 'created', 'Org user created', $user, [
            'email' => $user->email,
            'roles' => $data['roles'] ?? ['org_admin'],
        ]);

        return response()->json(['data' => new UserResource($user)], 201);
    }

    public function update(Request $request, User $user, LogOrgActivity $audit): UserResource
    {
        $tenantId = (string) tenant('id');
        if ($user->tenant_id !== $tenantId) {
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
        ]);

        $before = $user->only(['name', 'email']);
        $user->fill($data)->save();

        $audit->handle('users', 'updated', 'Org user updated', $user, [
            'before' => $before,
            'after' => $user->only(['name', 'email']),
        ]);

        return new UserResource($user->load('roles'));
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

        return new UserResource($updated);
    }

    public function destroy(User $user, LogOrgActivity $audit): JsonResponse
    {
        $tenantId = (string) tenant('id');
        if ($user->tenant_id !== $tenantId) {
            abort(404);
        }

        if ($user->id === auth()->id()) {
            abort(422, 'You cannot delete your own account.');
        }

        $snapshot = ['id' => $user->id, 'email' => $user->email, 'name' => $user->name];
        $user->delete();

        $audit->handle('users', 'deleted', 'Org user deleted', null, [
            'user' => $snapshot,
        ]);

        return response()->json(['message' => 'Deleted']);
    }
}
