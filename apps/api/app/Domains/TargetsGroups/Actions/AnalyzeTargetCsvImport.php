<?php

namespace App\Domains\TargetsGroups\Actions;

use App\Domains\IdentityAccess\Actions\ProvisionEmployeePair;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\TargetCsvParser;
use App\Domains\TargetsGroups\Support\TargetCsvRowNormalizer;
use App\Domains\TargetsGroups\Support\TargetProfileFields;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class AnalyzeTargetCsvImport
{
    public function __construct(
        private readonly TargetCsvParser $parser,
        private readonly TargetCsvRowNormalizer $normalizer,
        private readonly ProvisionEmployeePair $provision,
    ) {}

    /**
     * @param  array<string, string|null>  $columnMap
     * @return array{
     *   would_create: int,
     *   would_update: int,
     *   skipped: int,
     *   warning_count: int,
     *   errors: list<array{row: int, email: string|null, messages: list<string>}>,
     *   ready_rows: list<array{row: int, email: string, values: array<string, mixed>, warnings: list<string>, mapped_fields: list<string>}>
     * }
     */
    public function handle(string $absolutePath, array $columnMap): array
    {
        $columnMap = $this->parser->sanitizeColumnMap($columnMap);
        if (($columnMap['email'] ?? null) === null || $columnMap['email'] === '') {
            throw ValidationException::withMessages([
                'column_map.email' => ['Email column mapping is required.'],
            ]);
        }

        $parsed = $this->parser->parse($absolutePath);
        $headers = $parsed['headers'];
        $mappedFields = [];

        foreach ($columnMap as $field => $csvHeader) {
            if ($csvHeader === null || $csvHeader === '') {
                continue;
            }
            if (! in_array($csvHeader, $headers, true)) {
                throw ValidationException::withMessages([
                    "column_map.{$field}" => ["Mapped column \"{$csvHeader}\" was not found in the CSV header."],
                ]);
            }
            $mappedFields[] = $field;
        }

        $existingByEmail = Target::query()
            ->get(['id', 'email', 'employee_number'])
            ->keyBy(fn (Target $t) => strtolower((string) $t->email));

        $employeeNumbersInDb = [];
        foreach ($existingByEmail as $target) {
            if (filled($target->employee_number)) {
                $employeeNumbersInDb[strtolower((string) $target->employee_number)] = strtolower((string) $target->email);
            }
        }

        $seenEmails = [];
        $seenEmployeeNumbers = [];
        $wouldCreate = 0;
        $wouldUpdate = 0;
        $skipped = 0;
        $warningCount = 0;
        $errors = [];
        $readyRows = [];

        foreach ($parsed['rows'] as $index => $rawRow) {
            $rowNumber = $index + 2; // header is row 1
            $mapped = $this->parser->applyColumnMap($headers, $columnMap, $rawRow);
            $emailRaw = trim((string) ($mapped['email'] ?? ''));

            if ($emailRaw === '') {
                $skipped++;
                $errors[] = [
                    'row' => $rowNumber,
                    'email' => null,
                    'messages' => ['Email is required.'],
                ];

                continue;
            }

            $email = $this->provision->normalizeEmail($emailRaw);
            $emailValidator = Validator::make(['email' => $email], ['email' => ['required', 'email']]);
            if ($emailValidator->fails()) {
                $skipped++;
                $errors[] = [
                    'row' => $rowNumber,
                    'email' => $emailRaw,
                    'messages' => ['Email is invalid.'],
                ];

                continue;
            }

            if (isset($seenEmails[$email])) {
                $skipped++;
                $errors[] = [
                    'row' => $rowNumber,
                    'email' => $email,
                    'messages' => ['Duplicate email in file; first row wins.'],
                ];

                continue;
            }

            $normalized = $this->normalizer->normalize($mapped);
            $values = $normalized['values'];
            $warnings = $normalized['warnings'];
            $employeeNumber = $values['employee_number'] ?? null;

            if (is_string($employeeNumber) && $employeeNumber !== '') {
                $empKey = strtolower($employeeNumber);
                if (isset($seenEmployeeNumbers[$empKey]) && $seenEmployeeNumbers[$empKey] !== $email) {
                    $skipped++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'email' => $email,
                        'messages' => ['Duplicate employee_number in file.'],
                    ];

                    continue;
                }

                $dbOwner = $employeeNumbersInDb[$empKey] ?? null;
                if ($dbOwner !== null && $dbOwner !== $email) {
                    $skipped++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'email' => $email,
                        'messages' => ['employee_number already belongs to another employee.'],
                    ];

                    continue;
                }

                $seenEmployeeNumbers[$empKey] = $email;
            }

            $seenEmails[$email] = true;
            $exists = $existingByEmail->has($email);
            if ($exists) {
                $wouldUpdate++;
            } else {
                $wouldCreate++;
            }

            if ($warnings !== []) {
                $warningCount += count($warnings);
                $errors[] = [
                    'row' => $rowNumber,
                    'email' => $email,
                    'messages' => $warnings,
                ];
            }

            $readyRows[] = [
                'row' => $rowNumber,
                'email' => $email,
                'values' => $values,
                'warnings' => $warnings,
                'mapped_fields' => $mappedFields,
            ];
        }

        return [
            'would_create' => $wouldCreate,
            'would_update' => $wouldUpdate,
            'skipped' => $skipped,
            'warning_count' => $warningCount,
            'errors' => $errors,
            'ready_rows' => $readyRows,
            'platform_fields' => TargetProfileFields::CSV_HEADERS,
        ];
    }
}
