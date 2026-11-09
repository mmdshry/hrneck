<?php

namespace App\Http\Controllers\Api\V1\Org;

use App\Domains\Integrations\Actions\DispatchWebhookStub;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WebhookStubController extends Controller
{
    public function __invoke(Request $request, DispatchWebhookStub $dispatcher): JsonResponse
    {
        $data = $request->validate([
            'url' => ['nullable', 'url'],
            'event' => ['required', 'string', 'max:120'],
            'payload' => ['nullable', 'array'],
        ]);

        try {
            $result = $dispatcher->handle(
                $data['url'] ?? null,
                $data['event'],
                $data['payload'] ?? [],
            );
        } catch (\InvalidArgumentException $e) {
            throw ValidationException::withMessages([
                'url' => [$e->getMessage()],
            ]);
        }

        return response()->json(['data' => $result]);
    }
}
