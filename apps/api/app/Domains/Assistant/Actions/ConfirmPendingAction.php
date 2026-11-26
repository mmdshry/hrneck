<?php

namespace App\Domains\Assistant\Actions;

use App\Domains\Assistant\Models\AssistantPendingAction;
use App\Domains\Assistant\Support\AssistantPendingActionStatus;
use App\Domains\Assistant\Tools\AssistantToolRegistry;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Throwable;

/**
 * Runs a proposed write after the user confirms it from their own session. The agent cannot call this.
 */
class ConfirmPendingAction
{
    public function __construct(
        private readonly AssistantToolRegistry $registry,
        private readonly LogOrgActivity $audit,
    ) {}

    /**
     * @return array{status: int, body: array<string, mixed>}
     */
    public function handle(int $pendingActionId, User $user): array
    {
        return DB::transaction(function () use ($pendingActionId, $user): array {
            $action = AssistantPendingAction::query()
                ->whereKey($pendingActionId)
                ->lockForUpdate()
                ->first();

            if ($action === null || (int) $action->user_id !== (int) $user->id) {
                return ['status' => 404, 'body' => ['message' => 'Pending action not found.']];
            }

            if ($action->status !== AssistantPendingActionStatus::Pending) {
                return [
                    'status' => 409,
                    'body' => ['message' => 'This action was already resolved.', 'action_status' => $action->status->value],
                ];
            }

            if ($action->isExpired()) {
                $this->resolve($action, AssistantPendingActionStatus::Expired, null, 'expired');

                return ['status' => 409, 'body' => ['message' => 'This action expired. Ask the assistant to propose it again.']];
            }

            $tool = $this->registry->find($action->tool);
            if ($tool === null || ! $user->canAny([$tool->permission()])) {
                $this->resolve($action, AssistantPendingActionStatus::Failed, null, 'permission_denied');

                return ['status' => 403, 'body' => ['message' => 'You no longer have permission for this action.']];
            }

            // Rules are checked again at confirm time, in case the stored input no longer matches them.
            if (Validator::make($action->input, $tool->rules())->fails()) {
                $this->resolve($action, AssistantPendingActionStatus::Failed, null, 'invalid_input');

                return ['status' => 422, 'body' => ['message' => 'This action is no longer valid.']];
            }

            try {
                // Own transaction, so a failed write rolls back and leaves no partial change.
                $result = DB::transaction(fn (): array => $tool->run($action->input, $user));
            } catch (ModelNotFoundException) {
                $this->resolve($action, AssistantPendingActionStatus::Failed, null, 'not_found');

                return ['status' => 404, 'body' => ['message' => 'The item for this action no longer exists.']];
            } catch (Throwable $exception) {
                report($exception);
                $this->resolve($action, AssistantPendingActionStatus::Failed, null, 'execution_failed');

                return ['status' => 500, 'body' => ['message' => 'The action could not be completed.']];
            }

            $this->resolve($action, AssistantPendingActionStatus::Confirmed, $result, null);

            $this->audit->handle(
                'assistant',
                'pending_confirmed',
                'Assistant action confirmed by user',
                $action,
                ['tool' => $action->tool, 'pending_action_id' => $action->id],
                $user->id,
            );

            return ['status' => 200, 'body' => ['status' => 'confirmed', 'data' => $result]];
        });
    }

    /**
     * @param  array<string, mixed>|null  $result
     */
    private function resolve(
        AssistantPendingAction $action,
        AssistantPendingActionStatus $status,
        ?array $result,
        ?string $failureReason,
    ): void {
        $action->forceFill([
            'status' => $status,
            'result' => $result,
            'failure_reason' => $failureReason,
            'resolved_at' => now(),
        ])->save();
    }
}
