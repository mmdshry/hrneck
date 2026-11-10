<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Actions\ManageOrgRole;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrgRoleController extends Controller
{
    public function permissions(): JsonResponse
    {
        return response()->json([
            'data' => OrgPermissionCatalog::all(),
        ]);
    }

    public function index(Request $request, ManageOrgRole $manageOrgRole): JsonResponse
    {
        $roles = $manageOrgRole->list((string) tenant('id'))
            ->map(fn (Role $role): array => $this->serialize($role))
            ->values();

        $q = trim((string) $request->input('q', ''));
        $name = trim((string) $request->input('name', ''));
        if ($q !== '') {
            $needle = mb_strtolower($q);
            $roles = $roles->filter(
                fn (array $role): bool => str_contains(mb_strtolower((string) ($role['name'] ?? '')), $needle)
            )->values();
        }
        if ($name !== '') {
            $needle = mb_strtolower($name);
            $roles = $roles->filter(
                fn (array $role): bool => str_contains(mb_strtolower((string) ($role['name'] ?? '')), $needle)
            )->values();
        }

        $perPage = ApiPagination::perPage($request);
        $page = max(1, (int) $request->input('page', 1));
        $total = $roles->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        return response()->json([
            'data' => $roles->forPage($page, $perPage)->values(),
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    public function store(Request $request, ManageOrgRole $manageOrgRole, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string'],
        ]);

        $role = $manageOrgRole->create(
            (string) tenant('id'),
            $data['name'],
            $data['permissions'],
        );

        $audit->handle('roles', 'created', 'Role created', $role, [
            'name' => $role->name,
            'permissions' => $data['permissions'],
        ]);

        PublishLive::org([LiveTopics::ROLES, LiveTopics::USERS]);

        return response()->json(['data' => $this->serialize($role)], 201);
    }

    public function update(Request $request, Role $role, ManageOrgRole $manageOrgRole, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string'],
        ]);

        $before = $this->serialize($role);
        $updated = $manageOrgRole->update(
            (string) tenant('id'),
            $role,
            $data['name'] ?? null,
            $data['permissions'],
        );

        $audit->handle('roles', 'updated', 'Role updated', $updated, [
            'before' => $before,
            'after' => $this->serialize($updated),
        ]);

        PublishLive::org([LiveTopics::ROLES, LiveTopics::USERS]);

        return response()->json(['data' => $this->serialize($updated)]);
    }

    public function destroy(Role $role, ManageOrgRole $manageOrgRole, LogOrgActivity $audit): JsonResponse
    {
        $snapshot = $this->serialize($role);
        $manageOrgRole->delete((string) tenant('id'), $role);

        $audit->handle('roles', 'deleted', 'Role deleted', null, [
            'role' => $snapshot,
        ]);

        PublishLive::org([LiveTopics::ROLES, LiveTopics::USERS]);

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name')->values()->all(),
        ];
    }
}
