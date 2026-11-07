<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\DirectorySync\Actions\RunDirectorySync;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class DirectorySyncController extends Controller
{
    public function __invoke(RunDirectorySync $sync, LogOrgActivity $audit): JsonResponse
    {
        $result = $sync->handle();

        $audit->handle('targets', 'directory_sync', 'Directory sync requested', null, [
            'result' => $result,
        ]);

        return response()->json(['data' => $result]);
    }
}
