<?php

namespace App\Domains\TargetsGroups\Actions;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\Checklists\Actions\AssignAutoChecklistPacks;
use App\Domains\IdentityAccess\Actions\ProvisionEmployeePair;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\TargetsGroups\Models\Department;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\TargetCsvHeaderAliases;
use App\Domains\TargetsGroups\Support\TargetCsvParser;
use App\Domains\TargetsGroups\Support\TargetProfileFields;

final class CommitTargetCsvImport
{
    public function __construct(
        private readonly AnalyzeTargetCsvImport $analyze,
        private readonly ProvisionEmployeePair $provision,
        private readonly AssignAutoChecklistPacks $autoAssign,
        private readonly LogOrgActivity $audit,
        private readonly TargetCsvParser $parser,
        private readonly RecalculateTargetRisk $recalculateRisk,
    ) {}

    /**
     * @param  array<string, string|null>  $columnMap
     * @return array{
     *   created: int,
     *   updated: int,
     *   skipped: int,
     *   imported: int,
     *   errors: list<array{row: int, email: string|null, messages: list<string>}>,
     *   meta: array<string, mixed>
     * }
     */
    public function handle(
        string $absolutePath,
        array $columnMap,
        ?int $actorUserId = null,
        bool $aliasAwareIdentityMap = false,
        bool $sendInvites = false,
    ): array {
        if ($aliasAwareIdentityMap) {
            $columnMap = $this->identityMapFromFile($absolutePath);
        }

        $analysis = $this->analyze->handle($absolutePath, $columnMap);
        $tenantId = (string) tenant('id');
        $created = 0;
        $updated = 0;
        $autoAssigned = 0;
        $invited = 0;
        $managerSkipped = 0;
        $pendingManagers = [];
        $errors = $analysis['errors'];

        foreach ($analysis['ready_rows'] as $ready) {
            $email = $ready['email'];
            $values = $ready['values'];
            /** @var list<string> $mappedFields */
            $mappedFields = $ready['mapped_fields'];
            $mapped = array_fill_keys($mappedFields, true);

            $target = Target::query()->firstOrNew(['email' => $email]);
            $isNew = ! $target->exists;

            $fill = ['status' => 'active'];
            if ($isNew) {
                $fill['joined_via'] = 'csv';
            }

            foreach ([
                'first_name',
                'last_name',
                'job_title',
                'employee_number',
                'phone',
                'location',
                'employment_type',
                'hire_date',
                'preferred_language',
                'timezone',
                'external_id',
            ] as $field) {
                if (isset($mapped[$field])) {
                    $fill[$field] = $values[$field] ?? null;
                }
            }

            if (isset($mapped['department'])) {
                $departmentFields = $this->resolveDepartmentFromName($values['department'] ?? null);
                $fill['department_id'] = $departmentFields['department_id'];
                $fill['department'] = $departmentFields['department'];
            }

            try {
                $target->fill($fill);
                $target->save();
            } catch (\Throwable $e) {
                $errors[] = [
                    'row' => $ready['row'],
                    'email' => $email,
                    'messages' => ['Failed to save row: '.$e->getMessage()],
                ];

                continue;
            }

            $this->recalculateRisk->handle($target, force: true);

            if ($isNew) {
                $created++;
            } else {
                $updated++;
            }

            $pair = $this->provision->ensureUserForTarget($target, $tenantId, queueInvite: $sendInvites);
            if ($pair['invited']) {
                $invited++;
            }

            if ($isNew) {
                $autoAssigned += $this->autoAssign->handle($target, $actorUserId);
            }

            if (isset($mapped['manager_email'])) {
                $managerEmail = isset($values['manager_email']) && is_string($values['manager_email'])
                    ? $this->provision->normalizeEmail($values['manager_email'])
                    : '';
                if ($managerEmail !== '') {
                    $pendingManagers[] = ['target_id' => $target->id, 'manager_email' => $managerEmail];
                }
            }
        }

        foreach ($pendingManagers as $pending) {
            $manager = Target::query()
                ->whereRaw('LOWER(email) = ?', [$pending['manager_email']])
                ->first();
            if ($manager === null || (int) $manager->id === (int) $pending['target_id']) {
                $managerSkipped++;

                continue;
            }
            Target::query()->whereKey($pending['target_id'])->update([
                'manager_target_id' => $manager->id,
            ]);
        }

        $imported = $created + $updated;

        $this->audit->handle('targets', 'imported', 'Targets CSV imported', null, [
            'imported' => $imported,
            'created' => $created,
            'updated' => $updated,
            'skipped' => $analysis['skipped'],
            'auto_assigned_instance_count' => $autoAssigned,
            'login_invited' => $invited,
            'manager_skipped' => $managerSkipped,
        ]);

        PublishLive::metricsBundle();
        PublishLive::org([
            LiveTopics::TARGETS,
            LiveTopics::DEPARTMENTS,
            LiveTopics::CHECKLIST_INSTANCES,
        ]);

        return [
            'created' => $created,
            'updated' => $updated,
            'skipped' => $analysis['skipped'],
            'imported' => $imported,
            'errors' => $errors,
            'meta' => [
                'auto_assigned_instance_count' => $autoAssigned,
                'login_invited' => $invited,
                'manager_skipped' => $managerSkipped,
                'csv_headers' => TargetProfileFields::CSV_HEADERS,
                'warning_count' => $analysis['warning_count'],
            ],
        ];
    }

    /**
     * @return array{department_id: int|null, department: string|null}
     */
    private function resolveDepartmentFromName(?string $departmentName): array
    {
        $trimmed = trim((string) ($departmentName ?? ''));
        if ($trimmed === '') {
            return ['department_id' => null, 'department' => null];
        }

        $department = Department::query()->firstOrCreate(
            ['name' => mb_substr($trimmed, 0, 120)],
            ['is_active' => true],
        );

        return [
            'department_id' => $department->id,
            'department' => $department->name,
        ];
    }

    /**
     * @return array<string, string|null>
     */
    private function identityMapFromFile(string $absolutePath): array
    {
        $parsed = $this->parser->parse($absolutePath);

        return TargetCsvHeaderAliases::suggestMap($parsed['headers']);
    }
}
