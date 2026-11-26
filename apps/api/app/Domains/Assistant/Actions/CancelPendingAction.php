<?php

namespace App\Domains\Assistant\Actions;

use App\Domains\Assistant\Models\AssistantPendingAction;
use App\Domains\Assistant\Support\AssistantPendingActionStatus;
use App\Domains\Audit\Actions\LogOrgActivity;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CancelPendingAction
{
    public function __construct(private readonly LogOrgActivity $audit) {}

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

            $action->forceFill([
                'status' => AssistantPendingActionStatus::Cancelled,
                'resolved_at' => now(),
            ])->save();

            $this->audit->handle(
                'assistant',
                'pending_cancelled',
                'Assistant action cancelled by user',
                $action,
                ['tool' => $action->tool, 'pending_action_id' => $action->id],
                $user->id,
            );

            return ['status' => 200, 'body' => ['status' => 'cancelled']];
        });
    }
}
