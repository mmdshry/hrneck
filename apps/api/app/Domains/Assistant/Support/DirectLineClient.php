<?php

namespace App\Domains\Assistant\Support;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin client for the Direct Line REST API that fronts the Copilot Studio agent.
 *
 * Only this class talks to Microsoft. Secrets and conversation tokens never leave the server.
 */
final class DirectLineClient
{
    public function __construct(private readonly CopilotStudioSettings $settings) {}

    /**
     * @return array{conversation_id: string, token: string}
     *
     * @throws AssistantUnavailableException
     */
    public function startConversation(): array
    {
        $response = $this->http($this->settings->directLineSecret())
            ->post('/v3/directline/conversations');

        $this->assertSuccessful($response, 'start_conversation');

        return [
            'conversation_id' => (string) $response->json('conversationId'),
            'token' => (string) $response->json('token'),
        ];
    }

    /**
     * @param  array<string, mixed>  $channelData
     *
     * @throws AssistantUnavailableException
     */
    public function postMessage(
        string $conversationId,
        string $token,
        string $fromId,
        string $text,
        array $channelData,
    ): void {
        $response = $this->http($token)->post(
            "/v3/directline/conversations/{$conversationId}/activities",
            [
                'type' => 'message',
                'from' => ['id' => $fromId],
                'text' => $text,
                'channelData' => $channelData,
            ],
        );

        $this->assertSuccessful($response, 'post_message');
    }

    /**
     * @return array{activities: list<array<string, mixed>>, watermark: ?string}
     *
     * @throws AssistantUnavailableException
     */
    public function activitiesSince(string $conversationId, string $token, ?string $watermark): array
    {
        $query = $watermark !== null ? ['watermark' => $watermark] : [];

        $response = $this->http($token)->get(
            "/v3/directline/conversations/{$conversationId}/activities",
            $query,
        );

        $this->assertSuccessful($response, 'activities');

        /** @var list<array<string, mixed>> $activities */
        $activities = $response->json('activities') ?? [];

        $nextWatermark = $response->json('watermark');

        return [
            'activities' => $activities,
            'watermark' => is_string($nextWatermark) && $nextWatermark !== '' ? $nextWatermark : null,
        ];
    }

    private function http(string $bearer): PendingRequest
    {
        return Http::baseUrl($this->settings->directLineBaseUrl())
            ->withToken($bearer)
            ->acceptJson()
            ->connectTimeout(5)
            ->timeout(15);
    }

    /**
     * @throws AssistantUnavailableException
     */
    private function assertSuccessful(Response $response, string $operation): void
    {
        if ($response->successful()) {
            return;
        }

        // Log the status only. The body and headers can contain tokens.
        Log::warning('Copilot Studio Direct Line request failed.', [
            'operation' => $operation,
            'status' => $response->status(),
        ]);

        throw new AssistantUnavailableException("Direct Line {$operation} failed with status {$response->status()}.");
    }
}
