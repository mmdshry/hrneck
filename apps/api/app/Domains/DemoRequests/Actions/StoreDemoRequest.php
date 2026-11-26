<?php

namespace App\Domains\DemoRequests\Actions;

use App\Domains\DemoRequests\Models\DemoRequest;
use App\Domains\Notifications\Mails\BrandedNotificationMail;
use Illuminate\Support\Facades\Mail;
use Throwable;

class StoreDemoRequest
{
    /**
     * Saves the request before queuing the notification, so a mail failure never loses the lead.
     *
     * @param  array{name: string, work_email: string, company: string, role: string, message?: ?string, locale?: ?string}  $data
     */
    public function handle(array $data, ?string $ipAddress): DemoRequest
    {
        $demoRequest = DemoRequest::query()->create([
            'name' => $data['name'],
            'work_email' => $data['work_email'],
            'company' => $data['company'],
            'role' => $data['role'],
            'message' => $data['message'] ?? null,
            'locale' => $data['locale'] ?? null,
            'ip_address' => $ipAddress,
        ]);

        // Collapse whitespace so a crafted company name cannot inject mail headers.
        $company = trim((string) preg_replace('/\s+/u', ' ', $demoRequest->company));

        try {
            Mail::to((string) config('brand.support_address'))->queue(
                BrandedNotificationMail::fromPlainBody(
                    "New demo request: {$company}",
                    $this->body($demoRequest),
                )->replyTo($demoRequest->work_email, $demoRequest->name),
            );
        } catch (Throwable $exception) {
            // The lead is already saved. With the sync queue, an SMTP failure would otherwise surface
            // as an error and make the visitor resubmit, creating duplicates.
            report($exception);
        }

        return $demoRequest;
    }

    private function body(DemoRequest $demoRequest): string
    {
        return implode("\n", [
            "Name: {$demoRequest->name}",
            "Work email: {$demoRequest->work_email}",
            "Company: {$demoRequest->company}",
            "Role: {$demoRequest->role}",
            'Locale: '.($demoRequest->locale ?? 'unknown'),
            '',
            $demoRequest->message !== null && $demoRequest->message !== ''
                ? $demoRequest->message
                : '(No additional message)',
        ]);
    }
}
