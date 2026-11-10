<?php

namespace App\Domains\Campaigns\Jobs;

use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\TrainingLms\Models\Enrollment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendTrainingReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $recipientId,
        public int $enrollmentId,
    ) {}

    public function handle(): void
    {
        $recipient = CampaignRecipient::query()->with(['target', 'campaign'])->find($this->recipientId);
        $enrollment = Enrollment::query()->with('course')->find($this->enrollmentId);
        if (! $recipient?->target || ! $enrollment?->course) {
            return;
        }

        $campaignStatus = (string) ($recipient->campaign?->status ?? '');
        if (in_array($campaignStatus, ['cancelled', 'archived'], true)) {
            return;
        }

        $learnUrl = rtrim((string) config('brand.frontend_url', config('app.url')), '/')
            .'/learn?course='.$enrollment->course_id
            .'&enrollment='.$enrollment->id
            .'&target='.$enrollment->target_id;
        $body = "Hi {$recipient->target->first_name},\n\n"
            ."Please complete: {$enrollment->course->title}\n"
            ."Open: {$learnUrl}\n";

        try {
            Mail::raw($body, function ($message) use ($recipient, $enrollment): void {
                $message->to($recipient->target->email)
                    ->subject(config('brand.short').' training: '.$enrollment->course->title);
            });
        } catch (Throwable $e) {
            report($e);
            $recipient->forceFill([
                'status' => 'failed',
                'sent_at' => null,
            ])->save();

            return;
        }

        $recipient->forceFill([
            'status' => 'sent',
            'sent_at' => now(),
        ])->save();
    }
}
