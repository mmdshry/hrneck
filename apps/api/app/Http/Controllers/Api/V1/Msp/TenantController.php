<?php

namespace App\Http\Controllers\Api\V1\Msp;

use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Tenancy\Actions\ProvisionTenant;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Msp\StoreTenantRequest;
use App\Http\Resources\Api\V1\TenantResource;
use App\Models\Tenant;
use App\Support\ApiPagination;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TenantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return TenantResource::collection(
            Tenant::query()->latest()->paginate(ApiPagination::perPage($request))
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
}
