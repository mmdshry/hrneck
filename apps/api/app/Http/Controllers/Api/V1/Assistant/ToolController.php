<?php

namespace App\Http\Controllers\Api\V1\Assistant;

use App\Domains\Assistant\Actions\RunAssistantTool;
use App\Domains\Assistant\Support\AssistantRequestContext;
use App\Http\Controllers\Controller;
use App\Http\Middleware\AuthenticateAssistantTool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Tool calls from the Copilot Studio custom connector. Authenticated by AuthenticateAssistantTool, not Sanctum.
 */
class ToolController extends Controller
{
    public function __invoke(Request $request, string $tool, RunAssistantTool $action): JsonResponse
    {
        $context = $request->attributes->get(AuthenticateAssistantTool::CONTEXT_ATTRIBUTE);
        if (! $context instanceof AssistantRequestContext) {
            abort(401);
        }

        // The conversation token is credentials, not tool input. Keep it out of validation and stored actions.
        $result = $action->handle($tool, $request->except(AuthenticateAssistantTool::BODY_TOKEN_FIELDS), $context);

        return response()->json($result['body'], $result['status']);
    }
}
