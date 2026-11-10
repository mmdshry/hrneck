<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportScheduleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ReportSchedule::query()->latest()->get(),
        ]);
    }

    public function store(Request $request, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'cadence' => ['required', 'in:monthly,weekly,quarterly'],
            'format' => ['required', 'in:csv,pdf'],
            'recipient_email' => ['required', 'email'],
        ]);

        $this->ensurePdfExportPermission($request, $data['format']);

        $schedule = ReportSchedule::query()->create($data + [
            'next_run_at' => now(),
        ]);

        $audit->handle('reports', 'schedule_created', 'Report schedule created', $schedule, [
            'name' => $schedule->name,
            'cadence' => $schedule->cadence,
        ]);

        return response()->json(['data' => $schedule], 201);
    }

    public function update(Request $request, ReportSchedule $schedule, LogOrgActivity $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'cadence' => ['sometimes', 'in:monthly,weekly,quarterly'],
            'format' => ['sometimes', 'in:csv,pdf'],
            'recipient_email' => ['sometimes', 'email'],
        ]);

        $nextFormat = (string) ($data['format'] ?? $schedule->format);
        $this->ensurePdfExportPermission($request, $nextFormat);

        $before = $schedule->only(['name', 'cadence', 'format', 'recipient_email']);
        $schedule->fill($data)->save();

        $audit->handle('reports', 'schedule_updated', 'Report schedule updated', $schedule, [
            'before' => $before,
            'after' => $schedule->only(['name', 'cadence', 'format', 'recipient_email']),
        ]);

        return response()->json(['data' => $schedule]);
    }

    public function destroy(ReportSchedule $schedule, LogOrgActivity $audit): JsonResponse
    {
        $snapshot = $schedule->only(['id', 'name', 'cadence', 'recipient_email']);
        $schedule->delete();

        $audit->handle('reports', 'schedule_deleted', 'Report schedule deleted', null, [
            'schedule' => $snapshot,
        ]);

        return response()->json(['message' => 'Deleted']);
    }

    private function ensurePdfExportPermission(Request $request, string $format): void
    {
        if ($format !== 'pdf') {
            return;
        }

        abort_unless(
            $request->user()?->can(OrgPermissionCatalog::REPORTS_EXPORT) === true,
            403,
            'PDF report schedules require org.reports.export.',
        );
    }
}
