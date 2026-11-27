<?php

namespace App\Domains\Campaigns\Jobs;

use App\Domains\Campaigns\Actions\RecordTrainingAssignmentEvent;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Campaigns\Models\TrainingAssignment;
use App\Domains\Campaigns\Models\TrainingAssignmentEvent;
use App\Domains\Notifications\Mails\BrandedNotificationMail;
use App\Domains\Notifications\Support\NotificationEmailGate;
use App\Domains\Tenancy\Support\TenantAddress;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * One reminder per learner. The email lists every course the campaign assigned to them.
 */
class SendTrainingReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $recipientId,
    ) {}

    public function handle(TenantAddress $addresses): void
    {
        $recipient = CampaignRecipient::query()->with(['target', 'campaign'])->find($this->recipientId);
        if (! $recipient?->target || ! $recipient->campaign) {
            return;
        }

        if (in_array((string) $recipient->campaign->status, ['cancelled', 'archived'], true)) {
            return;
        }

        $targetEmail = (string) $recipient->target->email;
        if (! app(NotificationEmailGate::class)->allows($targetEmail)) {
            return;
        }

        $assignments = TrainingAssignment::query()
            ->where('recipient_id', $recipient->id)
            ->with('course')
            ->orderBy('id')
            ->get()
            ->filter(fn (TrainingAssignment $assignment): bool => $assignment->course !== null)
            ->values();
        if ($assignments->isEmpty()) {
            return;
        }

        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        $loginUrl = $addresses->loginUrl($tenantId);

        $entries = $assignments->map(function (TrainingAssignment $assignment) use ($recipient, $tenantId, $addresses): array {
            $query = array_filter([
                'tenant' => $tenantId,
                'course' => $assignment->course_id,
                'enrollment' => $assignment->enrollment_id,
                'target' => $recipient->target_id,
                'assignment' => $assignment->id,
            ], static fn ($value): bool => $value !== null && $value !== '');

            return [
                'title' => (string) $assignment->course->title,
                'url' => $addresses->url($tenantId, '/portal').'?'.http_build_query($query),
            ];
        })->all();

        $topic = count($entries) === 1 ? $entries[0]['title'] : count($entries).' courses';
        $subject = config('brand.short').' training: '.$topic;

        try {
            Mail::to($recipient->target->email)->send(new BrandedNotificationMail(
                subjectLine: $subject,
                title: 'Training reminder',
                lines: [
                    "Hi {$recipient->target->first_name},",
                    'Please complete the following training:',
                ],
                actions: array_map(
                    static fn (array $entry): array => ['label' => $entry['title'], 'url' => $entry['url']],
                    $entries,
                ),
                loginUrl: $loginUrl,
            ));
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

        foreach ($assignments as $assignment) {
            app(RecordTrainingAssignmentEvent::class)->append($assignment, TrainingAssignmentEvent::SENT);
        }
    }
}
