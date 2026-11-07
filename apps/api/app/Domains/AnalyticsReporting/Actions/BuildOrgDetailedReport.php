<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\Campaigns\Models\Campaign;
use App\Domains\Campaigns\Models\CampaignRecipient;
use App\Domains\Checklists\Models\ChecklistInstance;
use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\TargetsGroups\Models\Group;
use App\Domains\TargetsGroups\Models\Target;
use App\Domains\Ticketing\Actions\TicketingReports;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\TrainingLms\Models\Enrollment;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BuildOrgDetailedReport
{
    public const SECTIONS = [
        'company',
        'users',
        'targets',
        'campaigns',
        'recipients',
        'training',
        'checklists',
        'ticketing',
    ];

    public function __construct(
        private readonly BuildCampaignReport $campaignReport,
        private readonly TicketingReports $ticketingReports,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(): array
    {
        $ticketing = $this->ticketingReports->summary();

        return [
            'campaign' => $this->campaignReport->handle(),
            'counts' => [
                'users' => User::query()->where('tenant_id', (string) tenant('id'))->count(),
                'targets' => Target::query()->count(),
                'groups' => Group::query()->count(),
                'campaigns' => Campaign::query()->count(),
                'enrollments' => Enrollment::query()->count(),
                'checklist_templates' => ChecklistTemplate::query()->count(),
                'checklist_instances' => ChecklistInstance::query()->count(),
                'tickets_open' => $ticketing['total_open'],
                'tickets_resolved' => $ticketing['total_resolved'],
            ],
            'company' => $this->companyPayload(),
            'training_by_status' => Enrollment::query()
                ->selectRaw('status, count(*) as c')
                ->groupBy('status')
                ->pluck('c', 'status'),
            'checklists_by_status' => ChecklistInstance::query()
                ->selectRaw('status, count(*) as c')
                ->groupBy('status')
                ->pluck('c', 'status'),
            'ticketing' => $ticketing,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function section(string $section, array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $section = strtolower($section);
        if (! in_array($section, self::SECTIONS, true)) {
            throw new InvalidArgumentException("Unknown report section [{$section}].");
        }

        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage));

        return match ($section) {
            'company' => [
                'section' => 'company',
                'data' => $this->companyPayload(),
            ],
            'users' => $this->paginateSection('users', $this->usersQuery($filters), $page, $perPage, fn (User $user) => $this->mapUser($user)),
            'targets' => $this->paginateSection('targets', $this->targetsQuery($filters), $page, $perPage, fn (Target $target) => $this->mapTarget($target)),
            'campaigns' => $this->campaignsSection($filters, $page, $perPage),
            'recipients' => $this->paginateSection('recipients', $this->recipientsQuery($filters), $page, $perPage, fn (CampaignRecipient $row) => $this->mapRecipient($row)),
            'training' => $this->paginateSection('training', $this->trainingQuery($filters), $page, $perPage, fn (Enrollment $row) => $this->mapEnrollment($row)),
            'checklists' => [
                'section' => 'checklists',
                'summary' => [
                    'by_category' => ChecklistTemplate::query()
                        ->selectRaw('category, count(*) as c')
                        ->groupBy('category')
                        ->pluck('c', 'category'),
                    'by_status' => ChecklistInstance::query()
                        ->selectRaw('status, count(*) as c')
                        ->groupBy('status')
                        ->pluck('c', 'status'),
                    'templates' => ChecklistTemplate::query()->count(),
                    'instances' => ChecklistInstance::query()->count(),
                ],
                ...$this->paginateSection('checklists', $this->checklistsQuery($filters), $page, $perPage, fn (ChecklistInstance $row) => $this->mapChecklistInstance($row)),
            ],
            'ticketing' => [
                'section' => 'ticketing',
                'summary' => $this->ticketingReports->summary(
                    isset($filters['desk_id']) ? (int) $filters['desk_id'] : null,
                ),
                ...$this->paginateSection('ticketing', $this->ticketingQuery($filters), $page, $perPage, fn (SdTicket $row) => $this->mapTicket($row)),
            ],
            default => throw new InvalidArgumentException("Unknown report section [{$section}]."),
        };
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function csv(string $section, array $filters = []): StreamedResponse
    {
        $section = strtolower($section);
        if (! in_array($section, self::SECTIONS, true)) {
            throw new InvalidArgumentException("Unknown report section [{$section}].");
        }

        $filename = 'org-report-'.$section.'-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($section, $filters): void {
            $out = fopen('php://output', 'w');

            match ($section) {
                'company' => $this->writeCompanyCsv($out),
                'users' => $this->writeMappedCsv(
                    $out,
                    ['id', 'name', 'email', 'roles', 'mfa_enabled'],
                    $this->usersQuery($filters)->limit(5000)->get()->map(fn (User $u) => $this->mapUser($u)),
                ),
                'targets' => $this->writeMappedCsv(
                    $out,
                    ['id', 'email', 'first_name', 'last_name', 'department', 'status', 'risk_score', 'groups'],
                    $this->targetsQuery($filters)->limit(5000)->get()->map(function (Target $t) {
                        $mapped = $this->mapTarget($t);
                        $mapped['groups'] = implode('|', $mapped['groups']);

                        return $mapped;
                    }),
                ),
                'campaigns' => $this->writeCampaignsCsv($out, $filters),
                'recipients' => $this->writeMappedCsv(
                    $out,
                    ['id', 'campaign_id', 'campaign_name', 'email', 'name', 'department', 'status', 'sent_at', 'opened_at', 'clicked_at', 'submitted_at', 'reported_at'],
                    $this->recipientsQuery($filters)->limit(5000)->get()->map(fn (CampaignRecipient $r) => $this->mapRecipient($r)),
                ),
                'training' => $this->writeMappedCsv(
                    $out,
                    ['id', 'email', 'name', 'department', 'course', 'status', 'progress', 'opened_at', 'completed_at', 'source'],
                    $this->trainingQuery($filters)->limit(5000)->get()->map(fn (Enrollment $e) => $this->mapEnrollment($e)),
                ),
                'checklists' => $this->writeMappedCsv(
                    $out,
                    ['id', 'title', 'template', 'category', 'email', 'name', 'status', 'progress_pct', 'started_at', 'completed_at'],
                    $this->checklistsQuery($filters)->limit(5000)->get()->map(fn (ChecklistInstance $i) => $this->mapChecklistInstance($i)),
                ),
                'ticketing' => $this->writeMappedCsv(
                    $out,
                    ['id', 'number', 'summary', 'desk', 'stage', 'priority', 'status', 'sla_response_breached', 'sla_resolve_breached', 'created_at', 'resolved_at'],
                    $this->ticketingQuery($filters)->limit(5000)->get()->map(fn (SdTicket $t) => $this->mapTicket($t)),
                ),
                default => null,
            };

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array<string, mixed>
     */
    private function companyPayload(): array
    {
        $row = DB::table('organization_settings')->first();
        $meta = [];
        if ($row) {
            $meta = json_decode((string) ($row->meta ?? '{}'), true) ?: [];
        }

        $byDepartment = Target::query()
            ->selectRaw("coalesce(nullif(trim(department), ''), 'Unassigned') as department_label, count(*) as targets")
            ->groupBy('department_label')
            ->orderByDesc('targets')
            ->get()
            ->map(function ($item) {
                $dept = (string) $item->department_label;
                $recipientStats = $this->recipientFunnelForDepartment($dept === 'Unassigned' ? null : $dept);

                return [
                    'department' => $dept,
                    'targets' => (int) $item->targets,
                    'sent' => $recipientStats['sent'],
                    'opened' => $recipientStats['opened'],
                    'clicked' => $recipientStats['clicked'],
                    'click_rate' => $recipientStats['click_rate'],
                ];
            })
            ->values()
            ->all();

        $byGroup = Group::query()
            ->withCount('targets')
            ->orderBy('name')
            ->get()
            ->map(fn (Group $group) => [
                'id' => $group->id,
                'name' => $group->name,
                'targets' => $group->targets_count,
                'source' => $group->source,
            ])
            ->all();

        $tenantId = (string) tenant('id');
        $previousTeam = getPermissionsTeamId();
        setPermissionsTeamId($tenantId);
        try {
            $byRole = User::query()
                ->where('tenant_id', $tenantId)
                ->with('roles')
                ->get()
                ->flatMap(fn (User $user) => $user->getRoleNames())
                ->countBy()
                ->map(fn ($count, $role) => ['role' => (string) $role, 'users' => (int) $count])
                ->values()
                ->all();
        } finally {
            setPermissionsTeamId($previousTeam);
        }

        return [
            'profile' => [
                'display_name' => $row->display_name ?? null,
                'primary_color' => $row->primary_color ?? null,
                'timezone' => $row->timezone ?? null,
                'logo_path' => $row->logo_path ?? null,
                'sending_domain' => $meta['sending_domain'] ?? null,
                'webhook_url' => $meta['webhook_url'] ?? null,
                'updated_at' => $row->updated_at ?? null,
            ],
            'by_department' => $byDepartment,
            'by_group' => $byGroup,
            'by_role' => $byRole,
        ];
    }

    /**
     * @return array{sent: int, opened: int, clicked: int, click_rate: float}
     */
    private function recipientFunnelForDepartment(?string $department): array
    {
        $query = CampaignRecipient::query()->whereHas('target', function (Builder $q) use ($department): void {
            if ($department === null) {
                $q->where(function (Builder $inner): void {
                    $inner->whereNull('department')->orWhere('department', '');
                });
            } else {
                $q->where('department', $department);
            }
        });

        $recipients = $query->get(['sent_at', 'opened_at', 'clicked_at']);
        $sent = $recipients->whereNotNull('sent_at')->count();
        $opened = $recipients->whereNotNull('opened_at')->count();
        $clicked = $recipients->whereNotNull('clicked_at')->count();

        return [
            'sent' => $sent,
            'opened' => $opened,
            'clicked' => $clicked,
            'click_rate' => $sent > 0 ? round(($clicked / $sent) * 100, 1) : 0.0,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<User>
     */
    private function usersQuery(array $filters): Builder
    {
        $query = User::query()
            ->where('tenant_id', (string) tenant('id'))
            ->orderBy('name');

        if (! empty($filters['q'])) {
            $q = '%'.addcslashes((string) $filters['q'], '%_\\').'%';
            $query->where(function (Builder $inner) use ($q): void {
                $inner->where('name', 'like', $q)->orWhere('email', 'like', $q);
            });
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Target>
     */
    private function targetsQuery(array $filters): Builder
    {
        $query = Target::query()->with('groups')->latest('id');

        if (! empty($filters['q'])) {
            $q = '%'.addcslashes((string) $filters['q'], '%_\\').'%';
            $query->where(function (Builder $inner) use ($q): void {
                $inner->where('email', 'like', $q)
                    ->orWhere('first_name', 'like', $q)
                    ->orWhere('last_name', 'like', $q);
            });
        }
        if (! empty($filters['department'])) {
            $query->where('department', (string) $filters['department']);
        }
        if (! empty($filters['group_id'])) {
            $groupId = (int) $filters['group_id'];
            $query->whereHas('groups', fn (Builder $q) => $q->where('groups.id', $groupId));
        }
        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Campaign>
     */
    private function campaignsQuery(array $filters): Builder
    {
        $query = Campaign::query()->with('course')->latest('id');

        if (! empty($filters['q'])) {
            $q = '%'.addcslashes((string) $filters['q'], '%_\\').'%';
            $query->where('name', 'like', $q);
        }
        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }
        if (! empty($filters['type'])) {
            $query->where('type', (string) $filters['type']);
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<CampaignRecipient>
     */
    private function recipientsQuery(array $filters): Builder
    {
        $query = CampaignRecipient::query()
            ->with(['target', 'campaign'])
            ->latest('id');

        if (! empty($filters['campaign_id'])) {
            $query->where('campaign_id', (int) $filters['campaign_id']);
        }
        if (! empty($filters['q'])) {
            $q = '%'.addcslashes((string) $filters['q'], '%_\\').'%';
            $query->whereHas('target', function (Builder $inner) use ($q): void {
                $inner->where('email', 'like', $q)
                    ->orWhere('first_name', 'like', $q)
                    ->orWhere('last_name', 'like', $q);
            });
        }
        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Enrollment>
     */
    private function trainingQuery(array $filters): Builder
    {
        $query = Enrollment::query()
            ->with(['course', 'target'])
            ->latest('id');

        if (! empty($filters['course_id'])) {
            $query->where('course_id', (int) $filters['course_id']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }
        if (! empty($filters['q'])) {
            $q = '%'.addcslashes((string) $filters['q'], '%_\\').'%';
            $query->whereHas('target', function (Builder $inner) use ($q): void {
                $inner->where('email', 'like', $q)
                    ->orWhere('first_name', 'like', $q)
                    ->orWhere('last_name', 'like', $q);
            });
        }
        if (! empty($filters['group_id'])) {
            $groupId = (int) $filters['group_id'];
            $query->whereHas('target.groups', fn (Builder $q) => $q->where('groups.id', $groupId));
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<ChecklistInstance>
     */
    private function checklistsQuery(array $filters): Builder
    {
        $query = ChecklistInstance::query()
            ->with(['template', 'target'])
            ->latest('id');

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }
        if (! empty($filters['category'])) {
            $category = (string) $filters['category'];
            $query->whereHas('template', fn (Builder $q) => $q->where('category', $category));
        }
        if (! empty($filters['q'])) {
            $q = '%'.addcslashes((string) $filters['q'], '%_\\').'%';
            $query->where(function (Builder $inner) use ($q): void {
                $inner->where('title', 'like', $q)
                    ->orWhereHas('target', function (Builder $t) use ($q): void {
                        $t->where('email', 'like', $q)
                            ->orWhere('first_name', 'like', $q)
                            ->orWhere('last_name', 'like', $q);
                    });
            });
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<SdTicket>
     */
    private function ticketingQuery(array $filters): Builder
    {
        $query = SdTicket::query()
            ->with(['desk', 'stage', 'priority', 'status'])
            ->active()
            ->latest('id');

        if (! empty($filters['desk_id'])) {
            $query->where('desk_id', (int) $filters['desk_id']);
        }
        if (! empty($filters['q'])) {
            $q = '%'.addcslashes((string) $filters['q'], '%_\\').'%';
            $query->where(function (Builder $inner) use ($q): void {
                $inner->where('summary', 'like', $q)->orWhere('number', 'like', $q);
            });
        }

        return $query;
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @param  callable(TModel): array<string, mixed>  $mapper
     * @return array<string, mixed>
     */
    private function paginateSection(string $section, Builder $query, int $page, int $perPage, callable $mapper): array
    {
        /** @var LengthAwarePaginator<int, TModel> $paginator */
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'section' => $section,
            'data' => collect($paginator->items())->map($mapper)->values()->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapUser(User $user): array
    {
        $tenantId = (string) tenant('id');
        $previousTeam = getPermissionsTeamId();
        setPermissionsTeamId($tenantId);
        try {
            $roles = $user->getRoleNames()->values()->all();
        } finally {
            setPermissionsTeamId($previousTeam);
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $roles,
            'mfa_enabled' => (bool) $user->mfa_enabled,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapTarget(Target $target): array
    {
        return [
            'id' => $target->id,
            'email' => $target->email,
            'first_name' => $target->first_name,
            'last_name' => $target->last_name,
            'department' => $target->department,
            'status' => $target->status,
            'risk_score' => $target->risk_score,
            'groups' => $target->groups->pluck('name')->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function campaignsSection(array $filters, int $page, int $perPage): array
    {
        $paginator = $this->campaignsQuery($filters)->paginate($perPage, ['*'], 'page', $page);
        $stats = $this->campaignFunnelByIds(collect($paginator->items())->pluck('id')->all());

        return [
            'section' => 'campaigns',
            'data' => collect($paginator->items())
                ->map(fn (Campaign $campaign) => $this->mapCampaign($campaign, $stats[$campaign->id] ?? null))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  resource  $out
     */
    private function writeCampaignsCsv($out, array $filters): void
    {
        $campaigns = $this->campaignsQuery($filters)->limit(5000)->get();
        $stats = $this->campaignFunnelByIds($campaigns->pluck('id')->all());
        $this->writeMappedCsv(
            $out,
            ['id', 'name', 'type', 'status', 'recipients', 'sent', 'opened', 'clicked', 'submitted', 'reported', 'click_rate'],
            $campaigns->map(fn (Campaign $c) => $this->mapCampaign($c, $stats[$c->id] ?? null)),
        );
    }

    /**
     * @param  list<int>  $campaignIds
     * @return array<int, array{recipients: int, sent: int, opened: int, clicked: int, submitted: int, reported: int}>
     */
    private function campaignFunnelByIds(array $campaignIds): array
    {
        if ($campaignIds === []) {
            return [];
        }

        return CampaignRecipient::query()
            ->whereIn('campaign_id', $campaignIds)
            ->selectRaw('campaign_id')
            ->selectRaw('count(*) as recipients')
            ->selectRaw('sum(case when sent_at is not null then 1 else 0 end) as sent')
            ->selectRaw('sum(case when opened_at is not null then 1 else 0 end) as opened')
            ->selectRaw('sum(case when clicked_at is not null then 1 else 0 end) as clicked')
            ->selectRaw('sum(case when submitted_at is not null then 1 else 0 end) as submitted')
            ->selectRaw('sum(case when reported_at is not null then 1 else 0 end) as reported')
            ->groupBy('campaign_id')
            ->get()
            ->mapWithKeys(fn ($row) => [
                (int) $row->campaign_id => [
                    'recipients' => (int) $row->recipients,
                    'sent' => (int) $row->sent,
                    'opened' => (int) $row->opened,
                    'clicked' => (int) $row->clicked,
                    'submitted' => (int) $row->submitted,
                    'reported' => (int) $row->reported,
                ],
            ])
            ->all();
    }

    /**
     * @param  array{recipients: int, sent: int, opened: int, clicked: int, submitted: int, reported: int}|null  $stats
     * @return array<string, mixed>
     */
    private function mapCampaign(Campaign $campaign, ?array $stats = null): array
    {
        $stats ??= [
            'recipients' => 0,
            'sent' => 0,
            'opened' => 0,
            'clicked' => 0,
            'submitted' => 0,
            'reported' => 0,
        ];
        $total = $stats['recipients'];
        $clicked = $stats['clicked'];

        return [
            'id' => $campaign->id,
            'name' => $campaign->name,
            'type' => $campaign->type,
            'status' => $campaign->status,
            'course' => $campaign->course?->title,
            'recipients' => $total,
            'sent' => $stats['sent'],
            'opened' => $stats['opened'],
            'clicked' => $clicked,
            'submitted' => $stats['submitted'],
            'reported' => $stats['reported'],
            'click_rate' => $total > 0 ? round(($clicked / $total) * 100, 1) : 0.0,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapRecipient(CampaignRecipient $row): array
    {
        $target = $row->target;

        return [
            'id' => $row->id,
            'campaign_id' => $row->campaign_id,
            'campaign_name' => $row->campaign?->name,
            'email' => $target?->email,
            'name' => trim(($target?->first_name ?? '').' '.($target?->last_name ?? '')),
            'department' => $target?->department,
            'status' => $row->status,
            'sent_at' => optional($row->sent_at)?->toIso8601String(),
            'opened_at' => optional($row->opened_at)?->toIso8601String(),
            'clicked_at' => optional($row->clicked_at)?->toIso8601String(),
            'submitted_at' => optional($row->submitted_at)?->toIso8601String(),
            'reported_at' => optional($row->reported_at)?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapEnrollment(Enrollment $row): array
    {
        $target = $row->target;

        return [
            'id' => $row->id,
            'email' => $target?->email,
            'name' => trim(($target?->first_name ?? '').' '.($target?->last_name ?? '')),
            'department' => $target?->department,
            'course' => $row->course?->title,
            'course_id' => $row->course_id,
            'status' => $row->status,
            'progress' => $row->progress,
            'opened_at' => optional($row->opened_at)?->toIso8601String(),
            'completed_at' => optional($row->completed_at)?->toIso8601String(),
            'source' => $row->source,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapChecklistInstance(ChecklistInstance $row): array
    {
        $target = $row->target;

        return [
            'id' => $row->id,
            'title' => $row->title,
            'template' => $row->template?->name,
            'category' => $row->template?->category,
            'email' => $target?->email,
            'name' => trim(($target?->first_name ?? '').' '.($target?->last_name ?? '')),
            'status' => $row->status,
            'progress_pct' => $row->progress_pct,
            'started_at' => optional($row->started_at)?->toIso8601String(),
            'completed_at' => optional($row->completed_at)?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapTicket(SdTicket $row): array
    {
        return [
            'id' => $row->id,
            'number' => $row->number,
            'summary' => $row->summary,
            'desk' => $row->desk?->name,
            'stage' => $row->stage?->name,
            'priority' => $row->priority?->name,
            'status' => $row->status?->name,
            'sla_response_breached' => (bool) $row->sla_response_breached,
            'sla_resolve_breached' => (bool) $row->sla_resolve_breached,
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'resolved_at' => optional($row->resolved_at)?->toIso8601String(),
        ];
    }

    /**
     * @param  resource  $out
     * @param  list<string>  $headers
     * @param  Collection<int, array<string, mixed>>  $rows
     */
    private function writeMappedCsv($out, array $headers, Collection $rows): void
    {
        fputcsv($out, $headers);
        foreach ($rows as $row) {
            $line = [];
            foreach ($headers as $header) {
                $value = $row[$header] ?? '';
                if (is_bool($value)) {
                    $value = $value ? '1' : '0';
                } elseif (is_array($value)) {
                    $value = implode('|', $value);
                }
                $line[] = $value;
            }
            fputcsv($out, $line);
        }
    }

    /**
     * @param  resource  $out
     */
    private function writeCompanyCsv($out): void
    {
        $company = $this->companyPayload();

        fputcsv($out, ['section', 'key', 'value']);
        foreach ($company['profile'] as $key => $value) {
            fputcsv($out, ['profile', $key, is_scalar($value) || $value === null ? (string) ($value ?? '') : json_encode($value)]);
        }

        fputcsv($out, []);
        fputcsv($out, ['department', 'targets', 'sent', 'opened', 'clicked', 'click_rate']);
        foreach ($company['by_department'] as $row) {
            fputcsv($out, [$row['department'], $row['targets'], $row['sent'], $row['opened'], $row['clicked'], $row['click_rate']]);
        }

        fputcsv($out, []);
        fputcsv($out, ['group_id', 'group_name', 'targets', 'source']);
        foreach ($company['by_group'] as $row) {
            fputcsv($out, [$row['id'], $row['name'], $row['targets'], $row['source']]);
        }

        fputcsv($out, []);
        fputcsv($out, ['role', 'users']);
        foreach ($company['by_role'] as $row) {
            fputcsv($out, [$row['role'], $row['users']]);
        }
    }
}
