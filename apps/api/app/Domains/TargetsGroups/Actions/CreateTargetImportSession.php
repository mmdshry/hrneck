<?php

namespace App\Domains\TargetsGroups\Actions;

use App\Domains\TargetsGroups\Models\TargetImportSession;
use App\Domains\TargetsGroups\Support\TargetCsvHeaderAliases;
use App\Domains\TargetsGroups\Support\TargetCsvParser;
use App\Domains\TargetsGroups\Support\TargetProfileFields;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CreateTargetImportSession
{
    public function __construct(
        private readonly TargetCsvParser $parser,
    ) {}

    /**
     * @return array{
     *   session: TargetImportSession,
     *   suggested_map: array<string, string|null>,
     *   platform_fields: list<string>
     * }
     */
    public function handle(UploadedFile $file, ?int $createdBy = null): array
    {
        if ($file->getSize() !== null && $file->getSize() > TargetCsvParser::MAX_BYTES) {
            throw ValidationException::withMessages([
                'file' => ['CSV must be 5 MB or smaller.'],
            ]);
        }

        $uuid = (string) Str::uuid();
        $relativePath = 'imports/targets/'.$uuid.'.csv';
        $contents = file_get_contents($file->getRealPath());
        if ($contents === false) {
            throw ValidationException::withMessages([
                'file' => ['Unable to read uploaded file.'],
            ]);
        }

        Storage::disk('local')->put($relativePath, $contents);
        $absolute = Storage::disk('local')->path($relativePath);

        try {
            $parsed = $this->parser->parse($absolute);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($relativePath);
            throw $e;
        }

        $sampleRows = array_slice($parsed['rows'], 0, TargetCsvParser::SAMPLE_ROWS);
        $suggested = TargetCsvHeaderAliases::suggestMap($parsed['headers']);

        $session = TargetImportSession::query()->create([
            'id' => $uuid,
            'disk_path' => $relativePath,
            'original_filename' => mb_substr($file->getClientOriginalName() ?: 'targets.csv', 0, 255),
            'headers' => $parsed['headers'],
            'sample_rows' => $sampleRows,
            'row_count' => $parsed['row_count'],
            'created_by' => $createdBy,
            'expires_at' => now()->addHours(24),
        ]);

        return [
            'session' => $session,
            'suggested_map' => $suggested,
            'platform_fields' => TargetProfileFields::CSV_HEADERS,
        ];
    }
}
