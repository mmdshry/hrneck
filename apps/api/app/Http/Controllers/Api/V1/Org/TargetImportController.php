<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\TargetsGroups\Actions\AnalyzeTargetCsvImport;
use App\Domains\TargetsGroups\Actions\CommitTargetCsvImport;
use App\Domains\TargetsGroups\Actions\CreateTargetImportSession;
use App\Domains\TargetsGroups\Actions\DeleteTargetImportSession;
use App\Domains\TargetsGroups\Models\TargetImportMapping;
use App\Domains\TargetsGroups\Models\TargetImportSession;
use App\Domains\TargetsGroups\Support\TargetCsvParser;
use App\Domains\TargetsGroups\Support\TargetProfileFields;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TargetImportController extends Controller
{
    public function storeSession(
        Request $request,
        CreateTargetImportSession $create,
    ): JsonResponse {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $result = $create->handle($request->file('file'), $request->user()?->id);
        $session = $result['session'];

        return response()->json([
            'data' => [
                'id' => $session->id,
                'original_filename' => $session->original_filename,
                'headers' => $session->headers,
                'sample_rows' => $session->sample_rows,
                'row_count' => $session->row_count,
                'expires_at' => $session->expires_at->toIso8601String(),
                'suggested_map' => $result['suggested_map'],
                'platform_fields' => $result['platform_fields'],
            ],
        ], 201);
    }

    public function preview(
        Request $request,
        string $session,
        AnalyzeTargetCsvImport $analyze,
    ): JsonResponse {
        $model = $this->resolveActiveSession($session);
        $data = $request->validate([
            'column_map' => ['required', 'array'],
            'column_map.*' => ['nullable', 'string', 'max:255'],
        ]);

        $absolute = Storage::disk('local')->path($model->disk_path);
        $result = $analyze->handle($absolute, $data['column_map']);

        return response()->json([
            'data' => [
                'would_create' => $result['would_create'],
                'would_update' => $result['would_update'],
                'skipped' => $result['skipped'],
                'warning_count' => $result['warning_count'],
                'errors' => $result['errors'],
                'platform_fields' => TargetProfileFields::CSV_HEADERS,
            ],
        ]);
    }

    public function commit(
        Request $request,
        string $session,
        CommitTargetCsvImport $commit,
        DeleteTargetImportSession $deleteSession,
    ): JsonResponse {
        $model = $this->resolveActiveSession($session);
        $data = $request->validate([
            'column_map' => ['required', 'array'],
            'column_map.*' => ['nullable', 'string', 'max:255'],
            'mapping_id' => ['nullable', 'integer', 'exists:target_import_mappings,id'],
            'save_mapping' => ['nullable', 'array'],
            'save_mapping.name' => ['required_with:save_mapping', 'string', 'max:120'],
            'save_mapping.update_id' => ['nullable', 'integer', 'exists:target_import_mappings,id'],
            'send_invites' => ['sometimes', 'boolean'],
        ]);

        $absolute = Storage::disk('local')->path($model->disk_path);
        $result = $commit->handle(
            $absolute,
            $data['column_map'],
            $request->user()?->id,
            sendInvites: $request->boolean('send_invites', false),
        );

        if (isset($data['save_mapping'])) {
            $this->persistMapping(
                $data['save_mapping']['name'],
                $data['column_map'],
                isset($data['save_mapping']['update_id']) ? (int) $data['save_mapping']['update_id'] : null,
            );
        }

        $deleteSession->handle($model);

        return response()->json([
            'created' => $result['created'],
            'updated' => $result['updated'],
            'skipped' => $result['skipped'],
            'imported' => $result['imported'],
            'errors' => $result['errors'],
            'meta' => $result['meta'],
        ]);
    }

    public function importLegacy(
        Request $request,
        CommitTargetCsvImport $commit,
    ): JsonResponse {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $file = $request->file('file');
        $tmpRelative = 'imports/targets/legacy-'.uniqid('', true).'.csv';
        Storage::disk('local')->put($tmpRelative, file_get_contents($file->getRealPath()) ?: '');
        $absolute = Storage::disk('local')->path($tmpRelative);

        try {
            $result = $commit->handle(
                $absolute,
                [],
                $request->user()?->id,
                aliasAwareIdentityMap: true,
            );
        } finally {
            Storage::disk('local')->delete($tmpRelative);
        }

        return response()->json([
            'imported' => $result['imported'],
            'created' => $result['created'],
            'updated' => $result['updated'],
            'skipped' => $result['skipped'],
            'errors' => $result['errors'],
            'meta' => $result['meta'],
        ]);
    }

    public function indexMappings(): JsonResponse
    {
        $rows = TargetImportMapping::query()->orderBy('name')->get();

        return response()->json([
            'data' => $rows->map(fn (TargetImportMapping $m) => [
                'id' => $m->id,
                'name' => $m->name,
                'column_map' => $m->column_map,
                'updated_at' => $m->updated_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    public function storeMapping(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', 'unique:target_import_mappings,name'],
            'column_map' => ['required', 'array'],
            'column_map.*' => ['nullable', 'string', 'max:255'],
        ]);

        $mapping = $this->persistMapping($data['name'], $data['column_map']);

        return response()->json(['data' => $this->mappingPayload($mapping)], 201);
    }

    public function updateMapping(Request $request, int $mapping, TargetCsvParser $parser): JsonResponse
    {
        $model = TargetImportMapping::query()->findOrFail($mapping);
        $data = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:120',
                Rule::unique('target_import_mappings', 'name')->ignore($model->id),
            ],
            'column_map' => ['sometimes', 'array'],
            'column_map.*' => ['nullable', 'string', 'max:255'],
        ]);

        if (array_key_exists('name', $data)) {
            $model->name = $data['name'];
        }
        if (array_key_exists('column_map', $data)) {
            $model->column_map = $parser->sanitizeColumnMap($data['column_map']);
        }
        $model->save();

        return response()->json(['data' => $this->mappingPayload($model)]);
    }

    public function destroyMapping(int $mapping): JsonResponse
    {
        $model = TargetImportMapping::query()->findOrFail($mapping);
        $model->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function resolveActiveSession(string $sessionId): TargetImportSession
    {
        $session = TargetImportSession::query()->findOrFail($sessionId);
        $actorId = request()->user()?->id;
        if ($actorId === null || (int) $session->created_by !== (int) $actorId) {
            abort(403, 'Import session does not belong to the current user.');
        }
        if ($session->isExpired() || ! Storage::disk('local')->exists($session->disk_path)) {
            resolve(DeleteTargetImportSession::class)->handle($session);
            throw ValidationException::withMessages([
                'session' => ['Import session expired. Upload the CSV again.'],
            ]);
        }

        return $session;
    }

    /**
     * @param  array<string, mixed>  $columnMap
     */
    private function persistMapping(string $name, array $columnMap, ?int $updateId = null): TargetImportMapping
    {
        $sanitized = resolve(TargetCsvParser::class)->sanitizeColumnMap($columnMap);
        if (($sanitized['email'] ?? null) === null || $sanitized['email'] === '') {
            throw ValidationException::withMessages([
                'column_map.email' => ['Email column mapping is required.'],
            ]);
        }

        if ($updateId !== null) {
            $model = TargetImportMapping::query()->findOrFail($updateId);
            $model->name = $name;
            $model->column_map = $sanitized;
            $model->save();

            return $model;
        }

        return TargetImportMapping::query()->create([
            'name' => $name,
            'column_map' => $sanitized,
        ]);
    }

    /**
     * @return array{id: int, name: string, column_map: array<string, mixed>, updated_at: string|null}
     */
    private function mappingPayload(TargetImportMapping $mapping): array
    {
        return [
            'id' => $mapping->id,
            'name' => $mapping->name,
            'column_map' => $mapping->column_map,
            'updated_at' => $mapping->updated_at?->toIso8601String(),
        ];
    }
}
