<?php

namespace App\Domains\Realtime\Snapshots;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\MailDelivery\Models\SendingProfile;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Models\Tenant;

class LiveSnapshotBuilder
{
    public function __construct(
        private readonly BuildCampaignReport $campaignReport,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function forMsp(): array
    {
        $tenants = Tenant::query()->latest()->with('domains')->get();

        return [
            'data' => $tenants->map(fn (Tenant $tenant) => [
                'id' => $tenant->id,
                'name' => $tenant->name ?? data_get($tenant->data, 'name'),
                'industry' => $tenant->industry,
                'employee_band' => $tenant->employee_band,
                'status' => $tenant->status ?? 'active',
                'training_enabled' => (bool) ($tenant->training_enabled ?? true),
                'domains' => $tenant->domains->pluck('domain')->values()->all(),
            ])->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function forOrgTopic(string $topic): array
    {
        return match ($topic) {
            LiveTopics::METRICS, LiveTopics::REPORTS => [
                'summary' => $this->campaignReport->handle(),
            ],
            LiveTopics::REPORTS_EXPORT => [
                'calendar' => $this->exportCalendar(),
                'logs' => ReportArchive::query()->latest('generated_at')->limit(100)->get()->toArray(),
            ],
            LiveTopics::TRAINING_CAMPAIGNS => $this->trainingCampaigns(),
            LiveTopics::INTEGRATIONS => [
                'data' => $this->integrations(),
            ],
            LiveTopics::SENDING_PROFILES => [
                'data' => SendingProfile::query()->orderByDesc('is_default')->get()->toArray(),
            ],
            default => throw new \InvalidArgumentException("Unknown live topic [{$topic}]"),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function trainingCampaigns(): array
    {
        $campaigns = Campaign::query()->where('type', 'training')->with(['course', 'recipients'])->latest()->get();
        $courses = Course::query()->latest()->get(['id', 'title']);
        $targets = Target::query()->latest()->limit(500)->get(['id', 'email', 'first_name', 'last_name']);
        $groups = Group::query()->withCount('targets')->latest()->get();

        return [
            'dash' => $this->campaignDashboard('training'),
            'campaigns' => $campaigns->toArray(),
            'courses' => $courses->toArray(),
            'targets' => $targets->toArray(),
            'groups' => $groups->toArray(),
        ];
    }

    /**
     * @return array<string, int|float>
     */
    private function campaignDashboard(string $type): array
    {
        $campaigns = Campaign::query()->where('type', $type)->with('recipients')->get();
        $recipients = $campaigns->flatMap->recipients;
        $total = max(1, $recipients->count());

        $courseIds = $campaigns->pluck('course_id')->filter()->unique()->values();
        $enrollments = $courseIds->isEmpty()
            ? collect()
            : Enrollment::query()->whereIn('course_id', $courseIds)->get();
        $enrollmentTotal = max(1, $enrollments->count());
        $openedFromEnrollment = $enrollments->whereNotNull('opened_at')->count();
        $completedFromEnrollment = $enrollments->where('status', 'completed')->count();
        $openedRecipients = $recipients->filter(
            fn ($r) => $r->opened_at !== null || $r->status === 'completed' || $r->status === 'opened'
        )->count();
        $completedRecipients = $recipients->where('status', 'completed')->count();

        $openedCount = max($openedFromEnrollment, $openedRecipients);
        $completedCount = max($completedFromEnrollment, $completedRecipients);
        $metricTotal = max($enrollmentTotal, $total);

        return [
            'campaigns_total' => $campaigns->count(),
            'completed' => $campaigns->where('status', 'completed')->count(),
            'running' => $campaigns->where('status', 'running')->count(),
            'scheduled' => $campaigns->where('status', 'scheduled')->count(),
            'enrollments_total' => $enrollments->count(),
            'enrollments_completed' => $completedFromEnrollment,
            'enrollments_in_progress' => $enrollments->where('status', 'in_progress')->count(),
            'no_action_pct' => round((($metricTotal - $openedCount) / $metricTotal) * 100, 1),
            'opened_pct' => round(($openedCount / $metricTotal) * 100, 1),
            'completed_pct' => round(($completedCount / $metricTotal) * 100, 1),
        ];
    }

    /**
     * @return array{year: int, months: list<array{key: string, label: string, available: bool}>, quarters: list<array{key: string, label: string, available: bool}>}
     */
    private function exportCalendar(?int $year = null): array
    {
        $year ??= (int) now()->year;
        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $key = sprintf('%04d-%02d', $year, $m);
            $ready = ReportArchive::query()
                ->where('period_type', 'monthly')
                ->where('period_key', $key)
                ->where('status', 'ready')
                ->exists();
            $months[] = [
                'key' => $key,
                'label' => date('F', mktime(0, 0, 0, $m, 1)),
                'available' => $ready || $m < now()->month || $year < now()->year,
            ];
        }

        $quarters = [];
        foreach ([1, 2, 3, 4] as $q) {
            $key = sprintf('%04d-Q%d', $year, $q);
            $quarters[] = [
                'key' => $key,
                'label' => 'Q'.$q,
                'available' => ReportArchive::query()->where('period_key', $key)->exists()
                    || $q <= (int) ceil(now()->month / 3) || $year < now()->year,
            ];
        }

        return ['year' => $year, 'months' => $months, 'quarters' => $quarters];
    }

    /**
     * @return list<array{id: string, name: string, status: string, details: array<string, mixed>}>
     */
    private function integrations(): array
    {
        $smtpConfigured = filled(config('mail.mailers.smtp.host'))
            && filled(config('mail.mailers.smtp.username'));

        return [
            [
                'id' => 'smtp',
                'name' => 'SMTP mail',
                'status' => $smtpConfigured ? 'connected' : 'disconnected',
                'details' => [
                    'host' => config('mail.mailers.smtp.host'),
                    'port' => config('mail.mailers.smtp.port'),
                    'from' => config('mail.from.address'),
                    'support' => config('brand.support_address'),
                ],
            ],
            [
                'id' => 'entra_directory_sync',
                'name' => 'Microsoft Entra Directory Sync',
                'status' => 'coming_soon',
                'details' => ['message' => 'Add when credentials are available'],
            ],
            [
                'id' => 'graphus',
                'name' => 'Graphus',
                'status' => 'coming_soon',
                'details' => ['message' => 'Add when credentials are available'],
            ],
        ];
    }
}
