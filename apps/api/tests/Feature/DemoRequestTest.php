<?php

use App\Domains\DemoRequests\Models\DemoRequest;
use App\Domains\Notifications\Mails\BrandedNotificationMail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    config()->set('services.turnstile.secret_key', 'test-turnstile-secret');
    config()->set('brand.support_address', 'sales@hrneck.test');
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function demoRequestPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Ada Lovelace',
        'work_email' => 'ada@acme.test',
        'company' => 'Acme MSP',
        'role' => 'msp',
        'message' => 'Show me the training reports.',
        'locale' => 'en',
        'cf-turnstile-response' => 'token-123',
    ], $overrides);
}

test('a valid request is stored and queues a notification to support', function () {
    Mail::fake();
    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);

    $this->postJson('/api/v1/demo-requests', demoRequestPayload())
        ->assertCreated()
        ->assertJsonPath('status', 'received');

    $demoRequest = DemoRequest::query()->sole();
    expect($demoRequest->work_email)->toBe('ada@acme.test')
        ->and($demoRequest->company)->toBe('Acme MSP')
        ->and($demoRequest->role)->toBe('msp')
        ->and($demoRequest->ip_address)->toBe('127.0.0.1');

    Http::assertSent(fn (HttpRequest $request) => $request->url() === 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
        && $request['secret'] === 'test-turnstile-secret'
        && $request['response'] === 'token-123');

    Mail::assertQueued(
        BrandedNotificationMail::class,
        fn (BrandedNotificationMail $mail): bool => $mail->hasTo('sales@hrneck.test')
            && $mail->hasReplyTo('ada@acme.test'),
    );
});

test('invalid input is rejected without storing, verifying, or mailing', function () {
    Mail::fake();
    Http::fake();

    $this->postJson('/api/v1/demo-requests', demoRequestPayload([
        'work_email' => 'not-an-email',
        'role' => 'enterprise',
        'company' => '',
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['work_email', 'role', 'company']);

    expect(DemoRequest::query()->count())->toBe(0);
    Http::assertNothingSent();
    Mail::assertNothingQueued();
});

test('a rejected Turnstile token stores nothing and sends no mail', function () {
    Mail::fake();
    Http::fake([
        'challenges.cloudflare.com/*' => Http::response(['success' => false, 'error-codes' => ['invalid-input-response']]),
    ]);

    $this->postJson('/api/v1/demo-requests', demoRequestPayload())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cf-turnstile-response']);

    expect(DemoRequest::query()->count())->toBe(0);
    Mail::assertNothingQueued();
});

test('a filled honeypot gets a fake success without storing, verifying, or mailing', function () {
    Mail::fake();
    Http::fake();

    $this->postJson('/api/v1/demo-requests', demoRequestPayload(['website' => 'https://spam.example']))
        ->assertCreated();

    expect(DemoRequest::query()->count())->toBe(0);
    Http::assertNothingSent();
    Mail::assertNothingQueued();
});

test('a mail failure does not lose the saved request or turn the submission into an error', function () {
    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);
    Mail::shouldReceive('to')->once()->andThrow(new RuntimeException('SMTP unavailable'));

    $this->postJson('/api/v1/demo-requests', demoRequestPayload())
        ->assertCreated()
        ->assertJsonPath('status', 'received');

    expect(DemoRequest::query()->count())->toBe(1);
});

test('the endpoint returns 429 once the per-IP hourly limit is reached', function () {
    RateLimiter::for('demo-request', fn (Request $request) => Limit::perHour(1)->by('demo-request-ip:'.$request->ip()));
    Mail::fake();
    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);

    $this->postJson('/api/v1/demo-requests', demoRequestPayload())->assertCreated();
    $this->postJson('/api/v1/demo-requests', demoRequestPayload())->assertStatus(429);

    expect(DemoRequest::query()->count())->toBe(1);
});
