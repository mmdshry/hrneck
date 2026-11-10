<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Audit\Actions\LogOrgActivity;
use App\Domains\DirectorySync\Actions\RunDirectorySync;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
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

        PublishLive::org([
            LiveTopics::TARGETS,
            LiveTopics::GROUPS,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::REPORTS_DETAILED,
        ]);

        return response()->json(['data' => $result]);
    }
}
