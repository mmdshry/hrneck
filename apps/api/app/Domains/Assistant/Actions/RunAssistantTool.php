<?php

namespace App\Domains\Assistant\Actions;

use App\Domains\Assistant\Models\AssistantPendingAction;
use App\Domains\Assistant\Support\AssistantPendingActionStatus;
use App\Domains\Assistant\Support\AssistantRequestContext;
use App\Domains\Assistant\Support\CopilotStudioSettings;
use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\Assistant\Tools\AssistantToolRegistry;
use App\Domains\Audit\Actions\LogOrgActivity;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Entry point for a tool call from the Copilot Studio agent. Reads run now. Writes become pending actions.
 */
class RunAssistantTool
{
    public function __construct(
        private readonly AssistantToolRegistry $registry,
        private readonly CopilotStudioSettings $settings,
        private readonly LogOrgActivity $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{status: int, body: array<string, mixed>}
     */
    public function handle(string $toolName, array $input, AssistantRequestContext $context): array
    {
        $tool = $this->registry->find($toolName);
        if ($tool === null) {
            return ['status' => 404, 'body' => ['message' => 'Unknown assistant tool.']];
        }

        if (! $context->user->canAny([$tool->permission()])) {
            return ['status' => 403, 'body' => ['message' => 'You do not have permission to use this tool.']];
        }

        $validator = Validator::make($input, $tool->rules());
        if ($validator->fails()) {
            return [
                'status' => 422,
                'body' => ['message' => 'Invalid tool input.', 'errors' => $validator->errors()->toArray()],
            ];
        }

        $validated = $validator->validated();

        return $tool->writes()
            ? $this->proposeWrite($tool, $validated, $context)
            : $this->runRead($tool, $validated, $context);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{status: int, body: array<string, mixed>}
     */
    private function runRead(AssistantTool $tool, array $input, AssistantRequestContext $context): array
    {
        try {
            $data = $tool->run($input, $context->user);
        } catch (ModelNotFoundException) {
            return ['status' => 404, 'body' => ['message' => 'Not found.']];
        }

        $this->audit->handle(
            'assistant',
            'tool_executed',
            'Assistant ran '.$tool->name(),
            null,
            ['tool' => $tool->name(), 'conversation_id' => $context->conversation->id],
            $context->user->id,
        );

        return ['status' => 200, 'body' => ['data' => $data]];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{status: int, body: array<string, mixed>}
     */
    private function proposeWrite(AssistantTool $tool, array $input, AssistantRequestContext $context): array
    {
        $action = AssistantPendingAction::query()->create([
            'conversation_id' => $context->conversation->id,
            'user_id' => $context->user->id,
            'tool' => $tool->name(),
            'input' => $input,
            'summary' => Str::limit($tool->summarize($input), 480),
            'status' => AssistantPendingActionStatus::Pending,
            'expires_at' => now()->addMinutes($this->settings->pendingActionTtlMinutes()),
        ]);

        $this->audit->handle(
            'assistant',
            'pending_proposed',
            'Assistant proposed an action for confirmation',
            $action,
            ['tool' => $tool->name(), 'conversation_id' => $context->conversation->id],
            $context->user->id,
        );

        return [
            'status' => 202,
            'body' => [
                'status' => 'pending_confirmation',
                'pending_action_id' => $action->id,
                'summary' => $action->summary,
                'message' => 'This action has not run yet. The user must confirm it in HRneck before it runs.',
            ],
        ];
    }
}
