<?php

namespace App\Filament\Resources\Targets\Pages;

use App\Domains\DirectorySync\Actions\RunDirectorySync;
use App\Domains\TargetsGroups\Models\Target;
use App\Filament\Resources\Pages\ManageTenantRecords;
use App\Filament\Resources\Targets\TargetResource;
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
            CreateAction::make()->visible(fn (): bool => FilamentTenant::has()),
            Action::make('directorySync')
                ->label('Run directory sync')
                ->icon('heroicon-o-arrow-path')
                ->visible(fn (): bool => FilamentTenant::has())
                ->action(function (): void {
                    $result = app(RunDirectorySync::class)->handle();
                    Notification::make()
                        ->title('Directory sync complete')
                        ->body('Users: '.($result['users'] ?? 0).' / Groups: '.($result['groups'] ?? 0))
                        ->success()
                        ->send();
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
                    Notification::make()->title("Imported {$count} rows")->success()->send();
                }),
        ];
    }

    public function getHeading(): string
    {
        return FilamentTenant::has() ? 'Targets' : 'Targets — select an organization';
    }
}
