<?php

namespace App\Filament\Resources\Targets\Pages;

use App\Domains\TargetsGroups\Actions\RecalculateTargetRisk;
use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Filament\Resources\Targets\TargetResource;
use App\Support\AppLocale;
use App\Support\FilamentTenant;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Forms\Components\FileUpload;
use Filament\Notifications\Notification;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

class ManageTargets extends ManageTenantRecords
{
    protected static string $resource = TargetResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->visible(fn (): bool => FilamentTenant::has())
                ->mutateFormDataUsing(function (array $data): array {
                    unset($data['risk_score'], $data['risk_tier'], $data['risk_source'], $data['risk_updated_at']);

                    if (array_key_exists('preferred_language', $data)) {
                        $raw = $data['preferred_language'];
                        if ($raw === null || (is_string($raw) && trim($raw) === '')) {
                            $data['preferred_language'] = null;
                        } else {
                            $data['preferred_language'] = AppLocale::normalize(is_string($raw) ? $raw : null);
                        }
                    }

                    return $data;
                })
                ->after(function (Target $record): void {
                    app(RecalculateTargetRisk::class)->handle($record, force: true);
                }),
            Action::make('importCsv')
                ->label('Import CSV')
                ->icon('heroicon-o-arrow-up-tray')
                ->visible(fn (): bool => FilamentTenant::has())
                ->form([
                    FileUpload::make('file')
                        ->acceptedFileTypes(['text/csv', 'text/plain', '.csv'])
                        ->required()
                        ->storeFiles(false),
                ])
                ->action(function (array $data): void {
                    /** @var TemporaryUploadedFile $file */
                    $file = $data['file'];
                    $handle = fopen($file->getRealPath(), 'r');
                    $header = fgetcsv($handle) ?: [];
                    $count = 0;
                    while (($row = fgetcsv($handle)) !== false) {
                        if (count($header) !== count($row)) {
                            continue;
                        }
                        $item = array_combine($header, $row);
                        if (empty($item['email'])) {
                            continue;
                        }
                        Target::query()->updateOrCreate(
                            ['email' => trim((string) $item['email'])],
                            [
                                'first_name' => $item['first_name'] ?? null,
                                'last_name' => $item['last_name'] ?? null,
                                'department' => $item['department'] ?? null,
                                'status' => 'active',
                            ],
                        );
                        $count++;
                    }
                    fclose($handle);
                    Notification::make()->title(__('filament.imported_rows', ['count' => $count]))->success()->send();
                }),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has()
            ? __('filament.employees')
            : __('filament.employees_select_organization');
    }
}
