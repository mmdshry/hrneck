<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\AnalyticsReporting\Actions\ResolveReportRecipients;
use App\Domains\AnalyticsReporting\Models\ReportSchedule;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReportScheduleController extends Controller
{
    public function index(ResolveReportRecipients $resolveRecipients): JsonResponse
    {
        $schedules = ReportSchedule::query()->latest()->get();

        return response()->json([
            'data' => $this->serialize($schedules, $resolveRecipients)->values()->all(),
        ]);
    }

    /**
     * Members who may be chosen as report recipients.
     */
    public function recipients(ResolveReportRecipients $resolveRecipients): JsonResponse
    {
        $users = $resolveRecipients->handle((string) tenant('id'));

        return response()->json([
            'data' => $users->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])->values()->all(),
        ]);
    }

    public function store(Request $request, LogOrgActivity $audit, ResolveReportRecipients $resolveRecipients): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'cadence' => ['required', Rule::in(ReportSchedule::CADENCES)],
            'format' => ['required', Rule::in(ReportSchedule::FORMATS)],
            'section' => ['sometimes', Rule::in(ReportSchedule::SECTIONS)],
            'recipient_user_ids' => ['required', 'array', 'min:1'],
            'recipient_user_ids.*' => ['integer'],
        ]);

        $this->ensureSupportedCombination($data['cadence'], $data['format']);
        $this->ensurePdfExportPermission($request, $data['format']);

        $recipients = $resolveRecipients->requireEligible((string) tenant('id'), $data['recipient_user_ids']);
        $recipientIds = $recipients->pluck('id')->map(fn ($id): int => (int) $id)->all();

        $data['section'] ??= ReportSchedule::SUMMARY_SECTION;

        $schedule = DB::transaction(function () use ($data, $recipientIds): ReportSchedule {
            $schedule = ReportSchedule::query()->create(
                Arr::except($data, ['recipient_user_ids']) + ['next_run_at' => now()],
            );
            $schedule->syncRecipientUserIds($recipientIds);

            return $schedule;
        });

        $audit->handle('reports', 'schedule_created', 'Report schedule created', $schedule, [
            'name' => $schedule->name,
            'cadence' => $schedule->cadence,
            'section' => $schedule->section,
            'recipient_user_ids' => $recipientIds,
            'recipient_emails' => $recipients->pluck('email')->values()->all(),
        ]);

        return response()->json([
            'data' => $this->serialize(collect([$schedule]), $resolveRecipients)->first(),
        ], 201);
    }

    public function update(Request $request, ReportSchedule $schedule, LogOrgActivity $audit, ResolveReportRecipients $resolveRecipients): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'cadence' => ['sometimes', Rule::in(ReportSchedule::CADENCES)],
            'format' => ['sometimes', Rule::in(ReportSchedule::FORMATS)],
            'section' => ['sometimes', Rule::in(ReportSchedule::SECTIONS)],
            'recipient_user_ids' => ['sometimes', 'array', 'min:1'],
            'recipient_user_ids.*' => ['integer'],
        ]);

        $nextFormat = (string) ($data['format'] ?? $schedule->format);
        $nextCadence = (string) ($data['cadence'] ?? $schedule->cadence);
        $this->ensureSupportedCombination($nextCadence, $nextFormat);
        $this->ensurePdfExportPermission($request, $nextFormat);

        $before = $this->auditSnapshot($schedule);

        $recipientIds = null;
        if (isset($data['recipient_user_ids'])) {
            $recipientIds = $resolveRecipients
                ->requireEligible((string) tenant('id'), $data['recipient_user_ids'])
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
        }

        $scheduleFields = Arr::except($data, ['recipient_user_ids']);

        DB::transaction(function () use ($schedule, $scheduleFields, $recipientIds): void {
            $schedule->fill($scheduleFields)->save();

            if ($recipientIds !== null) {
                $schedule->syncRecipientUserIds($recipientIds);
            }
        });

        $audit->handle('reports', 'schedule_updated', 'Report schedule updated', $schedule, [
            'before' => $before,
            'after' => $this->auditSnapshot($schedule),
        ]);

        return response()->json([
            'data' => $this->serialize(collect([$schedule]), $resolveRecipients)->first(),
        ]);
    }

    public function destroy(ReportSchedule $schedule, LogOrgActivity $audit): JsonResponse
    {
        $snapshot = $schedule->only(['id', 'name', 'cadence']) + [
            'recipient_user_ids' => $schedule->recipientUserIds(),
        ];
        $schedule->delete();

        $audit->handle('reports', 'schedule_deleted', 'Report schedule deleted', null, [
            'schedule' => $snapshot,
        ]);

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Each recipient carries an `eligible` flag so the UI can flag people who lost report access.
     *
     * @param  Collection<int, ReportSchedule>  $schedules
     */
    private function serialize(Collection $schedules, ResolveReportRecipients $resolveRecipients): Collection
    {
        $eligibleIds = $resolveRecipients
            ->handle((string) tenant('id'))
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        $recipientIdsBySchedule = $schedules->mapWithKeys(
            fn (ReportSchedule $schedule): array => [$schedule->id => $schedule->recipientUserIds()],
        );

        $users = User::query()
            ->whereIn('id', $recipientIdsBySchedule->flatten()->unique()->values()->all())
            ->get(['id', 'name', 'email'])
            ->keyBy('id');

        return $schedules->map(fn (ReportSchedule $schedule): array => [
            ...$schedule->toArray(),
            'recipients' => collect($recipientIdsBySchedule->get($schedule->id, []))
                ->map(function (int $userId) use ($users, $eligibleIds): array {
                    $user = $users->get($userId);

                    return [
                        'id' => $userId,
                        'name' => $user?->name,
                        'email' => $user?->email,
                        'eligible' => in_array($userId, $eligibleIds, true),
                    ];
                })
                ->values()
                ->all(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditSnapshot(ReportSchedule $schedule): array
    {
        return $schedule->only(['name', 'cadence', 'format', 'section']) + [
            'recipient_user_ids' => $schedule->recipientUserIds(),
        ];
    }

    /**
     * PDF reports exist only as monthly or quarterly business reports, so a weekly PDF is refused
     * rather than silently sending the monthly one.
     */
    private function ensureSupportedCombination(string $cadence, string $format): void
    {
        if ($cadence === 'weekly' && $format === 'pdf') {
            throw ValidationException::withMessages([
                'cadence' => 'Weekly schedules can only be sent as CSV. PDF reports are monthly or quarterly.',
            ]);
        }
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
