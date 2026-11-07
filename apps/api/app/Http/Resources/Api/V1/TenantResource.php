<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Tenant */
class TenantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name ?? data_get($this->data, 'name'),
            'industry' => $this->industry,
            'employee_band' => $this->employee_band,
            'status' => $this->status ?? 'active',
            'training_enabled' => (bool) ($this->training_enabled ?? true),
            'domains' => $this->whenLoaded('domains', fn () => $this->domains->pluck('domain')),
        ];
    }
}
