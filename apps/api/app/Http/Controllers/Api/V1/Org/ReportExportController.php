<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\AnalyticsReporting\Actions\BuildQuarterlyPdfReport;
use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Http\Controllers\Controller;
use App\Support\ApiPagination;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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

    public function calendar(Request $request): JsonResponse
    {
        $year = (int) $request->input('year', now()->year);
        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $key = sprintf('%04d-%02d', $year, $m);
            $ready = ReportArchive::query()
                ->where('period_type', 'monthly')
                ->where('period_key', $key)
                ->where('status', 'ready')
                ->exists();
            $months[] = [
                'key' => $key,
                'label' => date('F', mktime(0, 0, 0, $m, 1)),
                'available' => $ready || $m < now()->month || $year < now()->year,
            ];
        }

        $quarters = [];
        foreach ([1, 2, 3, 4] as $q) {
            $key = sprintf('%04d-Q%d', $year, $q);
            $quarters[] = [
                'key' => $key,
                'label' => 'Q'.$q,
                'available' => ReportArchive::query()->where('period_key', $key)->exists()
                    || $q <= (int) ceil(now()->month / 3) || $year < now()->year,
            ];
        }

        return response()->json(['data' => ['year' => $year, 'months' => $months, 'quarters' => $quarters]]);
    }

    public function generate(Request $request, BuildQuarterlyPdfReport $builder, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', 'in:business,user'],
            'period_type' => ['required', 'in:monthly,quarterly,custom'],
            'period_key' => ['required', 'string', 'max:32'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'include_training' => ['sometimes', 'boolean'],
        ]);

        $result = $builder->handle($data['period_key'], $data['scope'], [
            'timezone' => $data['timezone'] ?? 'UTC',
            'include_training' => $request->boolean('include_training', true),
        ]);

        $archive = ReportArchive::query()->create([
            'name' => strtoupper($data['scope']).' '.$data['period_key'],
            'scope' => $data['scope'],
            'period_type' => $data['period_type'],
            'period_key' => $data['period_key'],
            'format' => 'pdf',
            'disk_path' => $result['path'],
            'timezone' => $data['timezone'] ?? 'UTC',
            'options' => [
                'include_training' => $request->boolean('include_training', true),
            ],
            'status' => 'ready',
            'generated_at' => now(),
        ]);

        $audit->handle('reports', 'archive_generated', 'Report archive generated', $archive, [
            'period_key' => $archive->period_key,
            'scope' => $archive->scope,
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
}
