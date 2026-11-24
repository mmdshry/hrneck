<?php

namespace App\Domains\Realtime\Snapshots;

use App\Domains\AnalyticsReporting\Actions\BuildCampaignReport;
use App\Domains\AnalyticsReporting\Actions\BuildExportCalendar;
use App\Domains\AnalyticsReporting\Actions\BuildOrgDetailedReport;
use App\Domains\AnalyticsReporting\Models\ReportArchive;
use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\IdentityAccess\Actions\ManageOrgRole;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\MailDelivery\Models\SendingProfile;
use App\Domains\Notifications\Models\OrgAnnouncement;
use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Notifications\Support\NotificationPayload;
use App\Domains\Notifications\Support\OrgBrandingCache;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\TargetsGroups\Models\Department;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\TargetsGroups\Support\ResolveActiveTarget;
use App\Domains\Ticketing\Actions\TicketingReports;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdEmailReader;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Support\TicketingPayload;
use App\Domains\TrainingLms\Models\Course;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;

class LiveSnapshotBuilder
{
    private const LIST_CAP = 500;

    public function __construct(
        private readonly BuildCampaignReport $campaignReport,
        private readonly BuildOrgDetailedReport $detailedReport,
        private readonly TicketingReports $ticketingReports,
        private readonly ManageOrgRole $manageOrgRole,
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
                'logs' => ReportArchive::query()
                    ->latest('generated_at')
                    ->limit(100)
                    ->get()
                    ->map(static fn (ReportArchive $archive): array => [
                        'id' => $archive->id,
                        'name' => $archive->name,
                        'scope' => $archive->scope,
                        'period_type' => $archive->period_type,
                        'period_key' => $archive->period_key,
                        'format' => $archive->format,
                        'timezone' => $archive->timezone,
                        'status' => $archive->status,
                        'generated_at' => $archive->generated_at,
                    ])
                    ->all(),
            ],
            LiveTopics::REPORTS_DETAILED => [
                'overview' => $this->detailedReport->overview(),
            ],
            LiveTopics::TRAINING_CAMPAIGNS => $this->trainingCampaigns(),
            LiveTopics::TRAINING => $this->trainingHub(),
            LiveTopics::CAMPAIGNS => [
                'data' => Campaign::query()->with(['course', 'recipients'])->latest()->limit(self::LIST_CAP)->get()->toArray(),
            ],
            LiveTopics::INTEGRATIONS => [
                'data' => $this->integrations(),
            ],
            LiveTopics::SENDING_PROFILES => [
                'data' => SendingProfile::query()->orderByDesc('is_default')->get()->toArray(),
            ],
            LiveTopics::USERS => $this->users(),
            LiveTopics::ROLES => $this->roles(),
            LiveTopics::TARGETS => [
                'data' => Target::query()
                    ->with(['groups', 'manager:id,email,first_name,last_name'])
                    ->latest()
                    ->limit(self::LIST_CAP)
                    ->get()
                    ->toArray(),
            ],
            LiveTopics::DEPARTMENTS => [
                'data' => Department::query()->withCount('targets')->orderBy('name')->limit(self::LIST_CAP)->get()->toArray(),
            ],
            LiveTopics::GROUPS => [
                'data' => Group::query()->withCount('targets')->latest()->limit(self::LIST_CAP)->get()->toArray(),
            ],
            LiveTopics::CHECKLISTS => [
                'data' => ChecklistTemplate::query()
                    ->with(['versions' => fn ($q) => $q->orderByDesc('version')])
                    ->orderByDesc('is_system')
                    ->orderBy('name')
                    ->limit(self::LIST_CAP)
                    ->get()
                    ->map(fn (ChecklistTemplate $t) => $this->checklistTemplatePayload($t))
                    ->values()
                    ->all(),
            ],
            LiveTopics::CHECKLIST_INSTANCES => [
                'data' => ChecklistInstance::query()
                    ->with(['target', 'template'])
                    ->latest()
                    ->limit(self::LIST_CAP)
                    ->get()
                    ->map(fn (ChecklistInstance $i) => $this->checklistInstancePayload($i))
                    ->values()
                    ->all(),
            ],
            LiveTopics::TICKETS => [
                'data' => SdTicket::query()
                    ->with(['desk', 'stage', 'status', 'priority'])
                    ->active()
                    ->latest()
                    ->limit(self::LIST_CAP)
                    ->get()
                    ->map(fn (SdTicket $t) => TicketingPayload::ticket($t))
                    ->values()
                    ->all(),
            ],
            LiveTopics::DESKS => [
                'data' => SdDesk::query()
                    ->orderBy('name')
                    ->get()
                    ->map(fn (SdDesk $d) => TicketingPayload::desk($d))
                    ->values()
                    ->all(),
            ],
            LiveTopics::KB => [
                'data' => SdKbArticle::query()
                    ->latest()
                    ->limit(self::LIST_CAP)
                    ->get()
                    ->map(fn (SdKbArticle $a) => TicketingPayload::kb($a))
                    ->values()
                    ->all(),
            ],
            LiveTopics::EMAIL_READERS => [
                'data' => SdEmailReader::query()->latest()->get()->toArray(),
            ],
            LiveTopics::TICKETING_REPORTS => [
                'summary' => $this->ticketingReports->summary(),
            ],
            LiveTopics::ANNOUNCEMENTS => [
                'data' => OrgAnnouncement::query()
                    ->orderByDesc('published_at')
                    ->orderByDesc('id')
                    ->limit(50)
                    ->get()
                    ->map(fn (OrgAnnouncement $row) => NotificationPayload::announcement($row))
                    ->values()
                    ->all(),
            ],
            LiveTopics::BRANDING => $this->branding(),
            default => throw new \InvalidArgumentException("Unknown live topic [{$topic}]"),
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function forLearnUser(int $userId): array
    {
        $user = User::query()->find($userId);
        if (! $user instanceof User || $user->email === '') {
            return ['data' => []];
        }

        $targetId = Target::query()->where('email', $user->email)->value('id');
        if ($targetId === null) {
            return ['data' => []];
        }

        $rows = Enrollment::query()
            ->with(['course.lessons', 'course.quizzes.questions', 'lessonProgress', 'target'])
            ->where('target_id', (int) $targetId)
            ->latest()
            ->get();

        return ['data' => $rows->toArray()];
    }

    /**
     * @return array<string, mixed>
     */
    public function forPortalUser(int $userId): array
    {
        $user = User::query()->find($userId);
        $targetId = $user instanceof User && $user->email !== ''
            ? Target::query()->where('email', $user->email)->value('id')
            : null;

        $query = SdTicket::query()
            ->with(['desk', 'stage', 'status', 'priority'])
            ->active()
            ->where(function ($q) use ($userId, $targetId): void {
                $q->where('requester_user_id', $userId);
                if ($targetId) {
                    $q->orWhere('requester_target_id', $targetId);
                }
            })
            ->latest()
            ->limit(self::LIST_CAP);

        $desks = SdDesk::query()
            ->where('is_active', true)
            ->whereIn('type', ['incident', 'service_request'])
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'type']);

        $kb = SdKbArticle::query()
            ->where('is_published', true)
            ->latest()
            ->limit(100)
            ->get();

        return [
            'tickets' => $query->get()->map(fn (SdTicket $t) => TicketingPayload::ticket($t))->values()->all(),
            'desks' => $desks->toArray(),
            'kb' => $kb->map(fn (SdKbArticle $a) => TicketingPayload::kb($a))->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function forNotificationsUser(int $userId): array
    {
        $rows = UserNotification::query()
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        $unread = UserNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->count();

        return [
            'data' => NotificationPayload::notificationList($rows),
            'meta' => [
                'unread_count' => $unread,
                'total' => $rows->count(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function trainingCampaigns(): array
    {
        $campaigns = Campaign::query()
            ->where('type', 'training')
            ->with(['course', 'recipients'])
            ->latest()
            ->limit(self::LIST_CAP)
            ->get();
        $courses = Course::query()->latest()->limit(self::LIST_CAP)->get(['id', 'title']);
        $targets = Target::query()->latest()->limit(self::LIST_CAP)->get(['id', 'email', 'first_name', 'last_name']);
        $groups = Group::query()->withCount('targets')->latest()->limit(self::LIST_CAP)->get();

        return [
            'dash' => $this->campaignDashboardFromCampaigns($campaigns),
            'campaigns' => $campaigns->toArray(),
            'courses' => $courses->toArray(),
            'targets' => $targets->toArray(),
            'groups' => $groups->toArray(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function trainingHub(): array
    {
        $courses = Course::query()->with(['lessons', 'quizzes'])->latest()->limit(self::LIST_CAP)->get();
        $enrollments = Enrollment::query()
            ->with(['course.lessons', 'course.quizzes', 'target', 'lessonProgress'])
            ->latest()
            ->limit(self::LIST_CAP)
            ->get();
        $targets = Target::query()->latest()->limit(self::LIST_CAP)->get(['id', 'email', 'first_name', 'last_name']);
        $groups = Group::query()->withCount('targets')->latest()->get();

        return [
            'courses' => $courses->toArray(),
            'enrollments' => $enrollments->toArray(),
            'targets' => $targets->toArray(),
            'groups' => $groups->toArray(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function users(): array
    {
        $tenantId = (string) tenant('id');
        $users = User::query()
            ->inTenant($tenantId)
            ->with('roles')
            ->orderBy('name')
            ->limit(self::LIST_CAP)
            ->get();
        app(ResolveActiveTarget::class)->attachLinkedTargets($users);

        $roles = $this->manageOrgRole->list($tenantId)
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name')->values()->all(),
            ])
            ->values()
            ->all();

        return [
            'data' => $users->map(fn (User $user) => (new UserResource($user))->resolve())->values()->all(),
            'roles' => $roles,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function roles(): array
    {
        $tenantId = (string) tenant('id');
        $roles = $this->manageOrgRole->list($tenantId)
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions->pluck('name')->values()->all(),
            ])
            ->values()
            ->all();

        return [
            'data' => $roles,
            'permissions' => OrgPermissionCatalog::all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function branding(): array
    {
        return [
            'data' => OrgBrandingCache::payload(includeTimezone: true),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function checklistTemplatePayload(ChecklistTemplate $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
            'category' => $t->category,
            'description' => $t->description,
            'status' => $t->status,
            'is_system' => $t->is_system,
            'versions' => $t->relationLoaded('versions')
                ? $t->versions->map(fn ($v) => [
                    'id' => $v->id,
                    'version' => $v->version,
                    'schema_json' => $v->schema_json,
                ])->values()->all()
                : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function checklistInstancePayload(ChecklistInstance $i): array
    {
        return [
            'id' => $i->id,
            'template_id' => $i->template_id,
            'target_id' => $i->target_id,
            'status' => $i->status,
            'completed_at' => optional($i->completed_at)?->toIso8601String(),
            'template' => $i->relationLoaded('template') && $i->template
                ? ['id' => $i->template->id, 'name' => $i->template->name]
                : null,
            'target' => $i->relationLoaded('target') && $i->target
                ? [
                    'id' => $i->target->id,
                    'email' => $i->target->email,
                    'first_name' => $i->target->first_name,
                    'last_name' => $i->target->last_name,
                ]
                : null,
        ];
    }

    /**
     * @param  Collection<int, Campaign>  $campaigns
     * @return array<string, int|float>
     */
    private function campaignDashboardFromCampaigns($campaigns): array
    {
        $recipients = $campaigns->flatMap->recipients;

        $courseIds = $campaigns->pluck('course_id')->filter()->unique()->values();
        $enrollments = $courseIds->isEmpty()
            ? collect()
            : Enrollment::query()->whereIn('course_id', $courseIds)->get();
        $enrollmentTotal = $enrollments->count();
        $openedFromEnrollment = $enrollments->whereNotNull('opened_at')->count();
        $completedFromEnrollment = $enrollments->where('status', 'completed')->count();
        $openedRecipients = $recipients->filter(
            fn ($r) => $r->opened_at !== null || $r->status === 'completed' || $r->status === 'opened'
        )->count();
        $completedRecipients = $recipients->where('status', 'completed')->count();

        $openedCount = max($openedFromEnrollment, $openedRecipients);
        $completedCount = max($completedFromEnrollment, $completedRecipients);
        $metricTotal = max($enrollmentTotal, $recipients->count());
        $noAction = $metricTotal === 0 ? 0 : max(0, $metricTotal - $openedCount);

        return [
            'campaigns_total' => $campaigns->count(),
            'completed' => $campaigns->where('status', 'completed')->count(),
            'running' => $campaigns->where('status', 'running')->count(),
            'scheduled' => $campaigns->where('status', 'scheduled')->count(),
            'enrollments_total' => $enrollments->count(),
            'enrollments_completed' => $completedFromEnrollment,
            'enrollments_in_progress' => $enrollments->where('status', 'in_progress')->count(),
            'no_action_pct' => $metricTotal === 0 ? 0 : round(($noAction / $metricTotal) * 100, 1),
            'opened_pct' => $metricTotal === 0 ? 0 : round(($openedCount / $metricTotal) * 100, 1),
            'completed_pct' => $metricTotal === 0 ? 0 : round(($completedCount / $metricTotal) * 100, 1),
        ];
    }

    /**
     * @return array{year: int, months: list<array{key: string, label: string, available: bool}>, quarters: list<array{key: string, label: string, available: bool}>}
     */
    private function exportCalendar(?int $year = null): array
    {
        return app(BuildExportCalendar::class)->handle($year);
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
                'id' => 'graphus',
                'name' => 'Graphus',
                'status' => 'coming_soon',
                'details' => ['message' => 'Add when credentials are available'],
            ],
        ];
    }
}
