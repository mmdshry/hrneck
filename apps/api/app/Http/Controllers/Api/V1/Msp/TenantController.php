<?php

namespace App\Http\Controllers\Api\V1\Msp;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Tenancy\Actions\ProvisionTenant;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Msp\StoreTenantRequest;
use App\Http\Resources\Api\V1\TenantResource;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\Tenant;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use App\Support\StaffTenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TenantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Tenant::query();
        ListQuery::applySearch($query, $request, ['name', 'industry', 'status', 'employee_band']);
        ListQuery::applyLikeFilters($query, $request, [
            'name' => 'name',
            'industry' => 'industry',
            'employee_band' => 'employee_band',
        ]);
        ListQuery::applyExactFilters($query, $request, [
            'status' => 'status',
        ]);
        ListQuery::applyBooleanFilters($query, $request, [
            'training_enabled' => 'training_enabled',
        ]);
        ListQuery::applySort($query, $request, [
            'name' => 'name',
            'status' => 'status',
            'industry' => 'industry',
        ], 'id', 'desc');

        return TenantResource::collection(
            $query->paginate(ApiPagination::perPage($request))
        );
    }

    public function store(StoreTenantRequest $request, ProvisionTenant $provision): TenantResource
    {
        $tenant = $provision->handle([
            'slug' => $request->string('slug')->toString(),
            'name' => $request->string('name')->toString(),
            'industry' => $request->input('industry'),
            'employee_band' => $request->input('employee_band', '1-10'),
            'status' => 'active',
            'training_enabled' => true,
        ]);

        PublishLive::msp();

        return new TenantResource($tenant);
    }

    public function update(Request $request, string $tenant): TenantResource
    {
        $model = Tenant::query()->findOrFail($tenant);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'industry' => ['nullable', 'string', 'max:120'],
            'employee_band' => ['nullable', 'string', 'max:40'],
            'status' => ['sometimes', 'in:active,inactive'],
            'training_enabled' => ['sometimes', 'boolean'],
        ]);

        $model->fill($data)->save();

        PublishLive::msp();

        return new TenantResource($model->fresh()->load('domains'));
    }

    public function enter(Request $request, string $tenant, LogOrgActivity $audit): JsonResponse
    {
        if (! $request->hasSession()) {
            abort(400, 'A browser session is required to enter a tenant context.');
        }

        $model = Tenant::query()->findOrFail($tenant);
        $request->session()->put(StaffTenant::SESSION_KEY, $model->id);

        // activity_log.subject_id is integer; tenant ids are strings — keep tenant in properties only.
        $audit->handle(
            'msp',
            'staff_tenant_enter',
            'Platform staff entered tenant context',
            null,
            ['tenant_id' => $model->id],
        );

        return response()->json([
            'data' => (new UserResource($request->user()))->resolve(),
            'tenant' => (new TenantResource($model->load('domains')))->resolve(),
        ]);
    }

    public function leave(Request $request, LogOrgActivity $audit): JsonResponse
    {
        if (! $request->hasSession()) {
            abort(400, 'A browser session is required to leave a tenant context.');
        }

        $previous = $request->session()->get(StaffTenant::SESSION_KEY);
        $request->session()->forget(StaffTenant::SESSION_KEY);

        if (is_string($previous) && $previous !== '') {
            $audit->handle(
                'msp',
                'staff_tenant_leave',
                'Platform staff left tenant context',
                null,
                ['tenant_id' => $previous],
            );
        }

        return response()->json([
            'data' => (new UserResource($request->user()))->resolve(),
        ]);
    }
}
