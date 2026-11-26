<?php

namespace App\Domains\Assistant\Actions;

use App\Domains\Assistant\Models\AssistantConversation;
use App\Domains\Assistant\Models\AssistantPendingAction;
use App\Domains\Assistant\Support\AssistantPendingActionStatus;
use App\Domains\Assistant\Support\AssistantUnavailableException;
use App\Domains\Assistant\Support\ConversationToken;
use App\Domains\Assistant\Support\CopilotStudioSettings;
use App\Domains\Assistant\Support\DirectLineClient;
use App\Models\User;

class SendMessage
{
    public function __construct(
        private readonly CopilotStudioSettings $settings,
        private readonly DirectLineClient $directLine,
    ) {}

    /**
     * @return array{replies: list<array{id: string, text: string}>, pending_actions: list<array<string, mixed>>}
     *
     * @throws AssistantUnavailableException
     */
    public function handle(string $conversationId, User $user, string $tenantId, string $text): array
    {
        $conversation = AssistantConversation::query()
            ->whereKey($conversationId)
            ->where('user_id', $user->id)
            ->where('tenant_id', $tenantId)
            ->first();

        if ($conversation === null) {
            abort(404, 'Conversation not found.');
        }

        if (! $conversation->isUsable()) {
            abort(409, 'This conversation has ended. Start a new one.');
        }

        $fromId = 'hrneck-user-'.$user->id;

        // The agent reads this token from the activity and passes it back on every tool call.
        $this->directLine->postMessage(
            $conversation->copilot_conversation_id,
            $conversation->direct_line_token,
            $fromId,
            $text,
            ['hrneck' => ['assistantToken' => ConversationToken::issue($conversation->id)]],
        );

        return [
            'replies' => $this->collectReplies($conversation, $fromId),
            'pending_actions' => $this->pendingActions($conversation->id),
        ];
    }

    /**
     * @return list<array{id: string, text: string}>
     *
     * @throws AssistantUnavailableException
     */
    private function collectReplies(AssistantConversation $conversation, string $fromId): array
    {
        $deadline = microtime(true) + $this->settings->replyTimeoutSeconds();
        $watermark = $conversation->watermark;
        $replies = [];

        while (true) {
            $page = $this->directLine->activitiesSince(
                $conversation->copilot_conversation_id,
                $conversation->direct_line_token,
                $watermark,
            );
            $watermark = $page['watermark'] ?? $watermark;

            $fresh = $this->botReplies($page['activities'], $fromId);
            $replies = [...$replies, ...$fresh];

            // One extra poll after the first reply so a multi-message answer is collected in full.
            if ($fresh === [] && $replies !== []) {
                break;
            }

            if (microtime(true) >= $deadline) {
                break;
            }

            usleep($this->settings->pollIntervalMs() * 1000);
        }

        $conversation->forceFill(['watermark' => $watermark])->save();

        return $replies;
    }

    /**
     * @param  list<array<string, mixed>>  $activities
     * @return list<array{id: string, text: string}>
     */
    private function botReplies(array $activities, string $fromId): array
    {
        $replies = [];

        foreach ($activities as $activity) {
            if (($activity['type'] ?? null) !== 'message') {
                continue;
            }

            if (($activity['from']['id'] ?? null) === $fromId) {
                continue;
            }

            $text = trim((string) ($activity['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $replies[] = ['id' => (string) ($activity['id'] ?? ''), 'text' => $text];
        }

        return $replies;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function pendingActions(string $conversationId): array
    {
        return AssistantPendingAction::query()
            ->where('conversation_id', $conversationId)
            ->where('status', AssistantPendingActionStatus::Pending)
            ->where('expires_at', '>', now())
            ->latest('id')
            ->get()
            ->map(static fn (AssistantPendingAction $action): array => [
                'id' => $action->id,
                'tool' => $action->tool,
                'summary' => $action->summary,
                'expires_at' => $action->expires_at->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
