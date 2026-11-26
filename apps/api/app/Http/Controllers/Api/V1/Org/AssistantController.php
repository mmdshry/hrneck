<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Assistant\Actions\CancelPendingAction;
use App\Domains\Assistant\Actions\ConfirmPendingAction;
use App\Domains\Assistant\Actions\SendMessage;
use App\Domains\Assistant\Actions\StartConversation;
use App\Domains\Assistant\Support\AssistantUnavailableException;
use App\Domains\Assistant\Support\CopilotStudioSettings;
use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\Assistant\Tools\AssistantToolRegistry;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Session-authenticated endpoints the HRneck chat UI calls. Every write is confirmed here, never by the agent.
 */
class AssistantController extends Controller
{
    public function status(
        Request $request,
        CopilotStudioSettings $settings,
        AssistantToolRegistry $registry,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $enabled = $settings->isEnabledForTenant((string) tenant('id'));
        $tools = $enabled ? $registry->allowedFor($user) : [];

        return response()->json([
            'data' => [
                'enabled' => $tools !== [],
                'tools' => array_map(
                    static fn (AssistantTool $tool): array => [
                        'name' => $tool->name(),
                        'description' => $tool->description(),
                        'writes' => $tool->writes(),
                    ],
                    $tools,
                ),
            ],
        ]);
    }

    public function startConversation(Request $request, StartConversation $action): JsonResponse
    {
        try {
            $conversation = $action->handle($request->user(), (string) tenant('id'));
        } catch (AssistantUnavailableException) {
            return $this->unavailable();
        }

        return response()->json([
            'data' => [
                'id' => $conversation->id,
                'expires_at' => $conversation->expires_at->toIso8601String(),
            ],
        ], 201);
    }

    public function sendMessage(Request $request, string $conversation, SendMessage $action): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:4000'],
        ]);

        try {
            $result = $action->handle($conversation, $request->user(), (string) tenant('id'), $data['message']);
        } catch (AssistantUnavailableException) {
            return $this->unavailable();
        }

        return response()->json(['data' => $result]);
    }

    public function confirmPendingAction(
        Request $request,
        int $pendingAction,
        ConfirmPendingAction $action,
    ): JsonResponse {
        $result = $action->handle($pendingAction, $request->user());

        return response()->json($result['body'], $result['status']);
    }

    public function cancelPendingAction(
        Request $request,
        int $pendingAction,
        CancelPendingAction $action,
    ): JsonResponse {
        $result = $action->handle($pendingAction, $request->user());

        return response()->json($result['body'], $result['status']);
    }

    private function unavailable(): JsonResponse
    {
        return response()->json(
            ['message' => 'The assistant is temporarily unavailable. Try again shortly.'],
            503,
        );
    }
}
