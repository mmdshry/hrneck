<?php

namespace App\Http\Controllers\Api\V1\Org\Ticketing;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Ticketing\Models\SdCategory;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdPriority;
use App\Domains\Ticketing\Models\SdProcedure;
use App\Domains\Ticketing\Models\SdSeverity;
use App\Domains\Ticketing\Models\SdSlaPolicy;
use App\Domains\Ticketing\Models\SdStage;
use App\Domains\Ticketing\Models\SdStatus;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DeskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = SdDesk::query()->orderBy('name')->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (SdDesk $d) => TicketingPayload::desk($d))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function show(int $desk): JsonResponse
    {
        $model = SdDesk::query()
            ->with(['stages', 'statuses', 'priorities', 'severities', 'categories', 'procedures', 'slaPolicies'])
            ->findOrFail($desk);

        return response()->json(['data' => TicketingPayload::desk($model, detailed: true)]);
    }

    public function store(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'type' => ['required', 'string', 'in:incident,problem,service_request,change,kb'],
            'number_prefix' => ['nullable', 'string', 'max:16'],
            'is_active' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
        ]);

        $desk = SdDesk::query()->create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(4)),
            'type' => $data['type'],
            'number_prefix' => $data['number_prefix'] ?? strtoupper(substr($data['type'], 0, 3)),
            'is_active' => $data['is_active'] ?? true,
            'is_system' => false,
            'settings' => $data['settings'] ?? [],
        ]);

        $audit->handle('ticketing', 'desk_created', 'Desk created', $desk, [
            'name' => $desk->name,
            'type' => $desk->type,
        ]);

        return response()->json(['data' => TicketingPayload::desk($desk)], 201);
    }

    public function update(Request $request, int $desk, LogOrgActivity $audit): JsonResponse
    {
        $model = SdDesk::query()->findOrFail($desk);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'number_prefix' => ['sometimes', 'string', 'max:16'],
            'is_active' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'nullable', 'array'],
        ]);
        $before = $model->only(['name', 'number_prefix', 'is_active']);
        $model->fill($data)->save();

        $event = array_key_exists('is_active', $data) && $data['is_active'] === false && $before['is_active']
            ? 'desk_archived'
            : 'desk_updated';

        $audit->handle('ticketing', $event, 'Desk '.$event, $model, [
            'before' => $before,
            'after' => $model->only(['name', 'number_prefix', 'is_active']),
        ]);

        return response()->json(['data' => TicketingPayload::desk($model->fresh() ?? $model)]);
    }

    public function storeStage(Request $request, int $desk): JsonResponse
    {
        SdDesk::query()->findOrFail($desk);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'sequence' => ['nullable', 'integer', 'min:0'],
            'default_escalation_minutes' => ['nullable', 'integer', 'min:1'],
            'is_terminal' => ['sometimes', 'boolean'],
        ]);

        $stage = SdStage::query()->create([
            'desk_id' => $desk,
            'name' => $data['name'],
            'sequence' => $data['sequence'] ?? 0,
            'default_escalation_minutes' => $data['default_escalation_minutes'] ?? null,
            'is_terminal' => (bool) ($data['is_terminal'] ?? false),
        ]);

        return response()->json(['data' => $stage], 201);
    }

    public function updateStage(Request $request, int $desk, int $stage): JsonResponse
    {
        $model = SdStage::query()->where('desk_id', $desk)->findOrFail($stage);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'sequence' => ['sometimes', 'integer', 'min:0'],
            'default_escalation_minutes' => ['nullable', 'integer', 'min:1'],
            'is_terminal' => ['sometimes', 'boolean'],
        ]);
        $model->fill($data)->save();

        return response()->json(['data' => $model]);
    }

    public function storeSupport(Request $request, int $desk, string $table): JsonResponse
    {
        SdDesk::query()->findOrFail($desk);
        $map = [
            'statuses' => SdStatus::class,
            'priorities' => SdPriority::class,
            'severities' => SdSeverity::class,
            'categories' => SdCategory::class,
        ];
        if (! isset($map[$table])) {
            abort(404);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:64'],
            'is_closed' => ['sometimes', 'boolean'],
            'weight' => ['sometimes', 'integer'],
            'parent_id' => ['nullable', 'integer'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $payload = [
            'desk_id' => $desk,
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']),
            'sort_order' => $data['sort_order'] ?? 0,
        ];
        if ($table === 'statuses') {
            $payload['is_closed'] = (bool) ($data['is_closed'] ?? false);
        }
        if ($table === 'priorities') {
            $payload['weight'] = (int) ($data['weight'] ?? 0);
        }
        if ($table === 'categories') {
            $payload['parent_id'] = $data['parent_id'] ?? null;
        }

        $row = $map[$table]::query()->create($payload);

        return response()->json(['data' => $row], 201);
    }

    public function storeProcedure(Request $request, int $desk): JsonResponse
    {
        SdDesk::query()->findOrFail($desk);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'hook' => ['required', 'string', 'in:on_create,on_stage_enter,on_escalation'],
            'stage_id' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'steps' => ['required', 'array'],
        ]);

        $procedure = SdProcedure::query()->create([
            'desk_id' => $desk,
            'name' => $data['name'],
            'hook' => $data['hook'],
            'stage_id' => $data['stage_id'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'steps' => $data['steps'],
        ]);

        return response()->json(['data' => $procedure], 201);
    }

    public function updateProcedure(Request $request, int $desk, int $procedure): JsonResponse
    {
        $model = SdProcedure::query()->where('desk_id', $desk)->findOrFail($procedure);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'hook' => ['sometimes', 'string', 'in:on_create,on_stage_enter,on_escalation'],
            'stage_id' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'steps' => ['sometimes', 'array'],
        ]);
        $model->fill($data)->save();

        return response()->json(['data' => $model]);
    }

    public function storeSla(Request $request, int $desk): JsonResponse
    {
        SdDesk::query()->findOrFail($desk);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'goals' => ['required', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        if (! empty($data['is_default'])) {
            SdSlaPolicy::query()->where('desk_id', $desk)->update(['is_default' => false]);
        }

        $policy = SdSlaPolicy::query()->create([
            'desk_id' => $desk,
            'name' => $data['name'],
            'goals' => $data['goals'],
            'is_default' => (bool) ($data['is_default'] ?? false),
        ]);

        return response()->json(['data' => $policy], 201);
    }

    public function updateSla(Request $request, int $desk, int $policy): JsonResponse
    {
        $model = SdSlaPolicy::query()->where('desk_id', $desk)->findOrFail($policy);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'goals' => ['sometimes', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        if (! empty($data['is_default'])) {
            SdSlaPolicy::query()->where('desk_id', $desk)->update(['is_default' => false]);
        }
        $model->fill($data)->save();

        return response()->json(['data' => $model]);
    }
}
