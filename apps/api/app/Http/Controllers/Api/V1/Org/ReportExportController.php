<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\AnalyticsReporting\Actions\BuildExportCalendar;
use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Target;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ReportArchive::query();
        ListQuery::applySearch($query, $request, ['name', 'scope', 'period_key', 'status']);
        ListQuery::applyLikeFilters($query, $request, [
            'name' => 'name',
            'scope' => 'scope',
            'period' => 'period_key',
        ]);
        ListQuery::applyExactFilters($query, $request, [
            'status' => 'status',
        ]);
        ListQuery::applySort($query, $request, [
            'name' => 'name',
            'status' => 'status',
            'generated_at' => 'generated_at',
        ], 'generated_at', 'desc');

        $rows = $query->paginate(ApiPagination::perPage($request));

        return response()->json([
            'data' => collect($rows->items())->values(),
            'meta' => ApiPagination::meta($rows),
        ]);
    }

    public function calendar(Request $request, BuildExportCalendar $calendar): JsonResponse
    {
        $year = (int) $request->input('year', now()->year);

        return response()->json(['data' => $calendar->handle($year)]);
    }

    public function generate(Request $request, BuildQuarterlyPdfReport $builder, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', 'in:business,user'],
            'period_type' => ['required', 'in:monthly,quarterly,custom'],
            'period_key' => ['required', 'string', 'max:32', 'regex:/^\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])$/'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'include_training' => ['sometimes', 'boolean'],
            'mode' => ['nullable', 'in:single,list', 'required_if:scope,user'],
            'target_id' => [
                'nullable',
                'integer',
                Rule::requiredIf(fn (): bool => $request->input('scope') === 'user' && $request->input('mode') === 'single'),
                'exists:targets,id',
            ],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'target_ids' => ['nullable', 'array', 'max:200'],
            'target_ids.*' => ['integer', 'exists:targets,id'],
        ]);

        $mode = $data['mode'] ?? null;
        $targetId = isset($data['target_id']) ? (int) $data['target_id'] : null;
        $groupId = isset($data['group_id']) ? (int) $data['group_id'] : null;
        /** @var list<int> $targetIds */
        $targetIds = array_values(array_unique(array_map(
            static fn ($id): int => (int) $id,
            $data['target_ids'] ?? [],
        )));

        $result = $builder->handle($data['period_key'], $data['scope'], [
            'timezone' => $data['timezone'] ?? 'UTC',
            'include_training' => $request->boolean('include_training', true),
            'mode' => $mode,
            'target_id' => $targetId,
            'group_id' => $groupId,
            'target_ids' => $targetIds,
        ]);

        $archiveName = $this->archiveName($data['scope'], $data['period_key'], $mode, $targetId);
        $options = [
            'include_training' => $request->boolean('include_training', true),
        ];
        if ($data['scope'] === 'user') {
            $options['mode'] = $mode;
            $options['target_id'] = $targetId;
            $options['group_id'] = $groupId;
            $options['target_ids'] = $targetIds;
        }

        $archive = ReportArchive::query()->create([
            'name' => $archiveName,
            'scope' => $data['scope'],
            'period_type' => $data['period_type'],
            'period_key' => $data['period_key'],
            'format' => 'pdf',
            'disk_path' => $result['path'],
            'timezone' => $data['timezone'] ?? 'UTC',
            'options' => $options,
            'status' => 'ready',
            'generated_at' => now(),
        ]);

        $audit->handle('reports', 'archive_generated', 'Report archive generated', $archive, [
            'period_key' => $archive->period_key,
            'scope' => $archive->scope,
            'mode' => $mode,
        ]);

        PublishLive::org([LiveTopics::REPORTS_EXPORT]);

        return response()->json(['data' => $archive], 201);
    }

    public function download(int $archive): StreamedResponse
    {
        $row = ReportArchive::query()->findOrFail($archive);

        return Storage::disk('local')->download($row->disk_path, $row->period_key.'-'.$row->scope.'.pdf');
    }

    public function destroy(int $archive, LogOrgActivity $audit): JsonResponse
    {
        $row = ReportArchive::query()->findOrFail($archive);
        $snapshot = $row->only(['id', 'name', 'period_key', 'scope', 'disk_path']);

        if ($row->disk_path && Storage::disk('local')->exists($row->disk_path)) {
            Storage::disk('local')->delete($row->disk_path);
        }

        $row->delete();

        $audit->handle('reports', 'archive_deleted', 'Report archive deleted', null, [
            'archive' => $snapshot,
        ]);

        PublishLive::org([LiveTopics::REPORTS_EXPORT]);

        return response()->json(['message' => 'Deleted']);
    }

    private function archiveName(string $scope, string $periodKey, ?string $mode, ?int $targetId): string
    {
        if ($scope !== 'user') {
            return strtoupper($scope).' '.$periodKey;
        }

        if ($mode === 'list') {
            return 'EMPLOYEE LIST '.$periodKey;
        }

        $label = 'Employee';
        if ($targetId !== null) {
            $target = Target::query()->find($targetId);
            if ($target !== null) {
                $name = trim(implode(' ', array_filter([(string) $target->first_name, (string) $target->last_name])));
                $label = $name !== '' ? $name : (string) $target->email;
            }
        }

        return 'EMPLOYEE '.$label.' '.$periodKey;
    }
}
