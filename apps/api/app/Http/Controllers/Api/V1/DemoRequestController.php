<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\DemoRequests\Actions\StoreDemoRequest;
use App\Domains\DemoRequests\Support\TurnstileVerifier;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreDemoRequestRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class DemoRequestController extends Controller
{
    public function __invoke(
        StoreDemoRequestRequest $request,
        TurnstileVerifier $turnstile,
        StoreDemoRequest $storeDemoRequest,
    ): JsonResponse {
        // Bots that fill the honeypot get the same success response, but nothing is stored or sent.
        if ($request->filled('website')) {
            return response()->json(['status' => 'received'], 201);
        }

        if (! $turnstile->verify((string) $request->input('cf-turnstile-response'), $request->ip())) {
            throw ValidationException::withMessages([
                'cf-turnstile-response' => ['Verification failed. Please try again.'],
            ]);
        }

        $storeDemoRequest->handle(
            $request->safe()->only(['name', 'work_email', 'company', 'role', 'message', 'locale']),
            $request->ip(),
        );

        return response()->json(['status' => 'received'], 201);
    }
}
