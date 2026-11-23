<?php

namespace App\Domains\TargetsGroups\Actions;

use App\Domains\TargetsGroups\Models\TargetImportSession;
use Illuminate\Support\Facades\Storage;

final class DeleteTargetImportSession
{
    public function handle(TargetImportSession $session): void
    {
        if ($session->disk_path !== '' && Storage::disk('local')->exists($session->disk_path)) {
            Storage::disk('local')->delete($session->disk_path);
        }
        $session->delete();
    }
}
