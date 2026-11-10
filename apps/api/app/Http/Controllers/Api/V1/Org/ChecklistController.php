<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Checklists\Actions\AssignChecklistPack;
use App\Domains\Checklists\Actions\CopySystemChecklistTemplate;
use App\Domains\Checklists\Actions\CreateChecklistInstances;
use App\Domains\Checklists\Actions\SaveChecklistPack;
use App\Domains\Checklists\Actions\SaveChecklistTemplate;
use App\Domains\Checklists\Actions\UpdateChecklistInstance;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistPack;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\Images\ConvertUploadedImageToWebp;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Activity;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChecklistController extends Controller
{
    public function templates(Request $request): JsonResponse
    {
        $query = ChecklistTemplate::query()->with(['versions' => fn ($q) => $q->orderByDesc('version')]);

        if ($request->filled('category')) {
            $query->where('category', (string) $request->input('category'));
        }
        if ($request->boolean('system_only')) {
            $query->where('is_system', true);
        }
        if ($request->boolean('editable_only')) {
            $query->where('is_system', false);
        }

        ListQuery::applySearch($query, $request, ['name', 'description', 'category', 'status']);
        ListQuery::applyLikeFilters($query, $request, [
            'name' => 'name',
            'description' => 'description',
        ]);
        ListQuery::applyExactFilters($query, $request, [
            'status' => 'status',
        ]);

        $rows = $query->orderByDesc('is_system')->orderBy('name')->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ChecklistTemplate $t) => $this->templatePayload($t))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function storeTemplate(Request $request, SaveChecklistTemplate $action): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'category' => ['nullable', 'string', 'in:onboarding,offboarding,hr_ops,custom'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:draft,published,archived'],
            'schema_json' => ['nullable', 'array'],
            'schema_json.items' => ['nullable', 'array'],
        ]);

        $template = $action->create($data, $request->user()?->id);

        PublishLive::org([LiveTopics::CHECKLISTS, LiveTopics::REPORTS_DETAILED]);

        return response()->json(['data' => $this->templatePayload($template->load('versions'))], 201);
    }

    public function showTemplate(int $template): JsonResponse
    {
        $model = ChecklistTemplate::query()->with(['versions' => fn ($q) => $q->orderByDesc('version')])->findOrFail($template);

        return response()->json(['data' => $this->templatePayload($model, detailed: true)]);
    }

    public function updateTemplate(Request $request, int $template, SaveChecklistTemplate $action): JsonResponse
    {
        $model = ChecklistTemplate::query()->findOrFail($template);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'category' => ['sometimes', 'string', 'in:onboarding,offboarding,hr_ops,custom'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', 'string', 'in:draft,published,archived'],
            'schema_json' => ['sometimes', 'array'],
            'schema_json.items' => ['sometimes', 'array'],
            'apply_to_open' => ['sometimes', 'boolean'],
        ]);

        $updated = $action->handle($model, $data, $request->user()?->id);

        PublishLive::org([LiveTopics::CHECKLISTS, LiveTopics::CHECKLIST_INSTANCES, LiveTopics::REPORTS_DETAILED]);

        return response()->json(['data' => $this->templatePayload($updated->load('versions'), detailed: true)]);
    }

    public function copyFromSystem(Request $request, int $template, CopySystemChecklistTemplate $action): JsonResponse
    {
        $model = ChecklistTemplate::query()->findOrFail($template);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:160'],
        ]);

        $copy = $action->handle($model, $request->user()?->id, $data['name'] ?? null);

        PublishLive::org([LiveTopics::CHECKLISTS]);

        return response()->json(['data' => $this->templatePayload($copy->load('versions'), detailed: true)], 201);
    }

    public function packs(Request $request): JsonResponse
    {
        $query = ChecklistPack::query()->with(['items.template']);

        ListQuery::applySearch($query, $request, ['name', 'description', 'status']);
        ListQuery::applyLikeFilters($query, $request, [
            'name' => 'name',
            'description' => 'description',
        ]);
        ListQuery::applyExactFilters($query, $request, [
            'status' => 'status',
        ]);
        if ($request->has('auto_assign_on_create')) {
            $query->where('auto_assign_on_create', $request->boolean('auto_assign_on_create'));
        }

        $rows = $query->orderBy('name')->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ChecklistPack $pack) => $this->packPayload($pack))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function storePack(Request $request, SaveChecklistPack $action): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:draft,published,archived'],
            'auto_assign_on_create' => ['sometimes', 'boolean'],
            'template_ids' => ['required', 'array', 'min:1'],
            'template_ids.*' => ['integer'],
        ]);

        $pack = $action->create($data, $request->user()?->id);

        return response()->json(['data' => $this->packPayload($pack)], 201);
    }

    public function showPack(int $pack): JsonResponse
    {
        $model = ChecklistPack::query()->with(['items.template'])->findOrFail($pack);

        return response()->json(['data' => $this->packPayload($model)]);
    }

    public function updatePack(Request $request, int $pack, SaveChecklistPack $action): JsonResponse
    {
        $model = ChecklistPack::query()->findOrFail($pack);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', 'string', 'in:draft,published,archived'],
            'auto_assign_on_create' => ['sometimes', 'boolean'],
            'template_ids' => ['sometimes', 'array', 'min:1'],
            'template_ids.*' => ['integer'],
        ]);

        $updated = $action->handle($model, $data, $request->user()?->id);

        return response()->json(['data' => $this->packPayload($updated)]);
    }

    public function assignPack(Request $request, int $pack, AssignChecklistPack $action): JsonResponse
    {
        $model = ChecklistPack::query()->with(['items.template'])->findOrFail($pack);
        $data = $request->validate([
            'target_ids' => ['nullable', 'array'],
            'target_ids.*' => ['integer'],
            'group_ids' => ['nullable', 'array'],
            'group_ids.*' => ['integer'],
        ]);

        $created = $action->handle(
            $model,
            $data['target_ids'] ?? [],
            $data['group_ids'] ?? [],
            $request->user()?->id,
        );

        return response()->json([
            'data' => collect($created)->map(
                fn (ChecklistInstance $i) => $this->instancePayload($i->load(['target', 'template']))
            )->values(),
        ], 201);
    }

    public function instances(Request $request): JsonResponse
    {
        $query = ChecklistInstance::query()->with(['target', 'template']);

        if ($request->filled('template_id')) {
            $query->where('template_id', (int) $request->input('template_id'));
        }
        if ($request->filled('target_id')) {
            $query->where('target_id', (int) $request->input('target_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        ListQuery::applySearch($query, $request, ['title']);
        ListQuery::applyLikeFilters($query, $request, [
            'title' => 'title',
            'email' => 'target.email',
            'assignee' => 'target.email',
        ]);

        $rows = $query->latest()->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ChecklistInstance $i) => $this->instancePayload($i))->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function storeInstances(Request $request, CreateChecklistInstances $action): JsonResponse
    {
        $data = $request->validate([
            'template_id' => ['required', 'integer'],
            'target_ids' => ['nullable', 'array'],
            'target_ids.*' => ['integer'],
            'group_ids' => ['nullable', 'array'],
            'group_ids.*' => ['integer'],
        ]);

        $template = ChecklistTemplate::query()->findOrFail((int) $data['template_id']);
        $created = $action->handle(
            $template,
            $data['target_ids'] ?? [],
            $data['group_ids'] ?? [],
            $request->user()?->id,
        );

        // PublishLive runs inside CreateChecklistInstances.

        return response()->json([
            'data' => collect($created)->map(fn (ChecklistInstance $i) => $this->instancePayload($i->load(['target', 'template'])))->values(),
        ], 201);
    }

    public function showInstance(int $instance): JsonResponse
    {
        $model = ChecklistInstance::query()->with(['answers', 'target', 'template'])->findOrFail($instance);

        return response()->json(['data' => $this->instancePayload($model, detailed: true)]);
    }

    public function updateInstance(Request $request, int $instance, UpdateChecklistInstance $action): JsonResponse
    {
        $model = ChecklistInstance::query()->findOrFail($instance);
        $data = $request->validate([
            'status' => ['sometimes', 'string', 'in:not_started,in_progress,completed,cancelled'],
            'reopen' => ['sometimes', 'boolean'],
            'answers' => ['sometimes', 'array'],
            'answers.*.item_key' => ['required', 'string', 'max:120'],
            'answers.*.value' => ['nullable'],
            'answers.*.file_disk_path' => ['nullable', 'string', 'max:512'],
            'answers.*.file_mime' => ['nullable', 'string', 'max:120'],
            'answers.*.file_size' => ['nullable', 'integer', 'min:0'],
        ]);

        $updated = $action->handle($model, $data, $request->user()?->id);

        PublishLive::org([
            LiveTopics::CHECKLIST_INSTANCES,
            LiveTopics::REPORTS_DETAILED,
        ], throttled: true);

        return response()->json(['data' => $this->instancePayload($updated, detailed: true)]);
    }

    public function uploadMedia(Request $request, ConvertUploadedImageToWebp $toWebp): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:51200', 'mimetypes:application/pdf,image/png,image/jpeg,image/webp,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ]);

        $file = $data['file'];
        $converted = $toWebp->handle($file);
        $tenant = (string) (tenant('id') ?: 'central');
        $ext = $converted['extension'] !== '' ? $converted['extension'] : 'bin';
        $path = sprintf('tenants/%s/checklists/%s.%s', $tenant, Str::uuid()->toString(), $ext);
        Storage::disk($this->disk())->put($path, $converted['contents']);

        $originalName = $file->getClientOriginalName();
        if ($converted['converted']) {
            $originalName = pathinfo($originalName, PATHINFO_FILENAME).'.webp';
        }

        return response()->json([
            'data' => [
                'file_disk_path' => $path,
                'file_mime' => $converted['mime'],
                'file_size' => strlen($converted['contents']),
                'original_name' => $originalName,
            ],
        ], 201);
    }

    public function streamMedia(int $instance, string $itemKey): StreamedResponse
    {
        $model = ChecklistInstance::query()->with('answers')->findOrFail($instance);
        $answer = $model->answers->firstWhere('item_key', $itemKey);
        abort_unless($answer && $answer->file_disk_path && Storage::disk($this->disk())->exists($answer->file_disk_path), 404);

        return Storage::disk($this->disk())->response(
            $answer->file_disk_path,
            basename($answer->file_disk_path),
            [
                'Content-Type' => $answer->file_mime ?: 'application/octet-stream',
                'Content-Disposition' => 'inline; filename="'.basename($answer->file_disk_path).'"',
            ],
        );
    }

    public function instanceAudit(int $instance): JsonResponse
    {
        ChecklistInstance::query()->findOrFail($instance);

        $rows = Activity::query()
            ->inLog('checklists')
            ->where('subject_type', ChecklistInstance::class)
            ->where('subject_id', $instance)
            ->latest()
            ->limit(200)
            ->get();

        return response()->json(['data' => $rows->map(fn (Activity $a) => $this->activityPayload($a))->values()]);
    }

    public function audit(Request $request): JsonResponse
    {
        $query = Activity::query()->inLog('checklists')->latest();

        if ($request->filled('event')) {
            $query->where('event', (string) $request->input('event'));
        }
        if ($request->filled('subject_type')) {
            $query->where('subject_type', (string) $request->input('subject_type'));
        }
        if ($request->filled('subject_id')) {
            $query->where('subject_id', (int) $request->input('subject_id'));
        }

        $rows = $query->limit(min(500, max(1, (int) $request->input('limit', 100))))->get();

        return response()->json(['data' => $rows->map(fn (Activity $a) => $this->activityPayload($a))->values()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function packPayload(ChecklistPack $pack): array
    {
        $items = $pack->relationLoaded('items') ? $pack->items : collect();

        return [
            'id' => $pack->id,
            'name' => $pack->name,
            'slug' => $pack->slug,
            'description' => $pack->description,
            'status' => $pack->status,
            'auto_assign_on_create' => (bool) $pack->auto_assign_on_create,
            'template_ids' => $items->pluck('template_id')->map(fn ($id) => (int) $id)->values()->all(),
            'templates' => $items->map(function ($item) {
                $template = $item->template;

                return [
                    'id' => $template !== null ? $template->id : (int) $item->template_id,
                    'name' => $template !== null ? $template->name : 'Template #'.$item->template_id,
                    'category' => $template !== null ? $template->category : null,
                    'status' => $template !== null ? $template->status : null,
                    'is_system' => $template !== null ? (bool) $template->is_system : false,
                    'sort_order' => (int) $item->sort_order,
                ];
            })->values()->all(),
            'updated_at' => $pack->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function templatePayload(ChecklistTemplate $template, bool $detailed = false): array
    {
        $latest = $template->versions->firstWhere('version', $template->current_version)
            ?? $template->versions->sortByDesc('version')->first();

        $payload = [
            'id' => $template->id,
            'name' => $template->name,
            'slug' => $template->slug,
            'category' => $template->category,
            'description' => $template->description,
            'status' => $template->status,
            'is_system' => $template->is_system,
            'current_version' => $template->current_version,
            'updated_at' => $template->updated_at?->toIso8601String(),
        ];

        if ($detailed || $latest) {
            $payload['schema_json'] = $latest?->schema_json ?? ['items' => []];
            $payload['latest_version_id'] = $latest?->id;
        }

        if ($detailed) {
            $payload['versions'] = $template->versions->map(fn ($v) => [
                'id' => $v->id,
                'version' => $v->version,
                'created_by' => $v->created_by,
                'created_at' => $v->created_at?->toIso8601String(),
            ])->values();
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function instancePayload(ChecklistInstance $instance, bool $detailed = false): array
    {
        $payload = [
            'id' => $instance->id,
            'template_id' => $instance->template_id,
            'template_version_id' => $instance->template_version_id,
            'target_id' => $instance->target_id,
            'title' => $instance->title,
            'status' => $instance->status,
            'progress_pct' => $instance->progress_pct,
            'started_at' => $instance->started_at?->toIso8601String(),
            'completed_at' => $instance->completed_at?->toIso8601String(),
            'assigned_by' => $instance->assigned_by,
            'updated_at' => $instance->updated_at?->toIso8601String(),
            'target' => $instance->relationLoaded('target') && $instance->target ? [
                'id' => $instance->target->id,
                'email' => $instance->target->email,
                'first_name' => $instance->target->first_name,
                'last_name' => $instance->target->last_name,
                'department' => $instance->target->department,
            ] : null,
            'template' => $instance->relationLoaded('template') && $instance->template ? [
                'id' => $instance->template->id,
                'name' => $instance->template->name,
                'category' => $instance->template->category,
            ] : null,
        ];

        if ($detailed) {
            $payload['schema_snapshot'] = $instance->schema_snapshot;
            $payload['answers'] = $instance->relationLoaded('answers')
                ? $instance->answers->map(fn ($a) => [
                    'item_key' => $a->item_key,
                    'value' => $a->decodedValue(),
                    'file_disk_path' => $a->file_disk_path,
                    'file_mime' => $a->file_mime,
                    'file_size' => $a->file_size,
                    'updated_by' => $a->updated_by,
                    'updated_at' => $a->updated_at?->toIso8601String(),
                ])->values()
                : [];
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function activityPayload(Activity $activity): array
    {
        return [
            'id' => $activity->id,
            'event' => $activity->event,
            'description' => $activity->description,
            'subject_type' => $activity->subject_type,
            'subject_id' => $activity->subject_id,
            'causer_id' => $activity->causer_id,
            'properties' => $activity->properties?->toArray() ?? [],
            'created_at' => $activity->created_at?->toIso8601String(),
        ];
    }

    private function disk(): string
    {
        return (string) config('filesystems.training_disk', 'local');
    }
}
