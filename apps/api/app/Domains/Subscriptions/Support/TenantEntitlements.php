<?php

namespace App\Domains\Subscriptions\Support;

use App\Domains\Subscriptions\Exceptions\PlanLimitReached;
use App\Domains\Subscriptions\Models\SubscriptionPlan;
use App\Domains\Subscriptions\Models\TenantSubscription;
use App\Domains\TargetsGroups\Models\Target;
use App\Models\Tenant;
use App\Models\TenantMembership;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Stancl\Tenancy\Facades\Tenancy;

final class TenantEntitlements
{
    private const LINKED_USER_CHUNK_SIZE = 1000;

    /**
     * Features come from the plan only. Features are unrestricted when no plan is configured at all, so
     * existing installs keep working. Read-only status does not hide features: reads keep working and
     * writes are blocked by EnsureSubscriptionWritable.
     */
    public function hasFeature(string $tenantId, PlanFeature $feature): bool
    {
        $plan = $this->stateFor($tenantId)['plan'];

        if ($plan === null) {
            return true;
        }

        return $plan->includesFeature($feature);
    }

    /**
     * The status to report when org writes are blocked, or null when the tenant can still write.
     */
    public function readOnlyStatus(string $tenantId): ?SubscriptionStatus
    {
        $subscription = $this->stateFor($tenantId)['subscription'];
        $now = now();

        if ($subscription === null || ! $subscription->isReadOnly($now)) {
            return null;
        }

        return $subscription->effectiveStatus($now);
    }

    /**
     * Plan, status and usage against limits. Used by /auth/me and the org app.
     *
     * @return array{
     *     plan_name: string|null,
     *     status: string|null,
     *     effective_status: string|null,
     *     read_only: bool,
     *     ends_at: string|null,
     *     over_limit: bool,
     *     usage: array{
     *         employees: array{used: int, limit: int|null, over_limit: bool},
     *         users: array{used: int, limit: int|null, over_limit: bool}
     *     },
     *     features: array{learner_portal: bool, knowledge_base: bool}
     * }
     */
    public function summary(string $tenantId): array
    {
        $state = $this->stateFor($tenantId);
        $subscription = $state['subscription'];
        $plan = $state['plan'];
        $now = now();
        $counts = $this->usage($tenantId);

        $employees = $this->usageItem($counts['employees'], $plan?->limitFor(PlanLimit::Employees));
        $users = $this->usageItem($counts['users'], $plan?->limitFor(PlanLimit::Users));

        return [
            'plan_name' => $plan?->name,
            'status' => $subscription?->status->value,
            'effective_status' => $subscription?->effectiveStatus($now)->value,
            'read_only' => $subscription?->isReadOnly($now) ?? false,
            'ends_at' => $this->relevantEnd($subscription)?->toIso8601String(),
            'over_limit' => $employees['over_limit'] || $users['over_limit'],
            'usage' => ['employees' => $employees, 'users' => $users],
            'features' => [
                'learner_portal' => $this->hasFeature($tenantId, PlanFeature::LearnerPortal),
                'knowledge_base' => $this->hasFeature($tenantId, PlanFeature::KnowledgeBase),
            ],
        ];
    }

    /**
     * @return array{employees: int, users: int}
     */
    public function usage(string $tenantId): array
    {
        return [
            'employees' => $this->countEmployees($tenantId),
            'users' => $this->countUsers($tenantId),
        ];
    }

    public function assignDefaultPlan(string $tenantId): void
    {
        $plan = $this->defaultPlan();

        if ($plan === null || TenantSubscription::query()->where('tenant_id', $tenantId)->exists()) {
            return;
        }

        TenantSubscription::query()->create([
            'tenant_id' => $tenantId,
            'subscription_plan_id' => $plan->getKey(),
            'status' => SubscriptionStatus::Active,
            'starts_at' => now(),
        ]);
    }

    public function assertCanCreateTargets(string $tenantId, int $count = 1): void
    {
        $this->assertWithinLimit($tenantId, PlanLimit::Employees, $count);
    }

    /**
     * Only emails that do not already exist as Targets consume an employee seat.
     *
     * @param  list<string>  $emails
     */
    public function assertCanCreateTargetsForEmails(string $tenantId, array $emails): void
    {
        $normalized = array_values(array_unique(array_map(
            fn (string $email): string => strtolower(trim($email)),
            $emails,
        )));

        if ($normalized === []) {
            return;
        }

        $newCount = $this->inTenant($tenantId, function () use ($normalized): int {
            $existing = Target::query()
                ->whereIn('email', $normalized)
                ->pluck('email')
                ->map(fn (string $email): string => strtolower(trim($email)))
                ->all();

            return count(array_diff($normalized, $existing));
        });

        $this->assertCanCreateTargets($tenantId, $newCount);
    }

    public function assertCanAddUsers(string $tenantId, int $count = 1): void
    {
        $this->assertWithinLimit($tenantId, PlanLimit::Users, $count);
    }

    /**
     * An account consumes an employee seat only when it creates a new Target.
     */
    public function assertCanGrantEmployeeTarget(string $tenantId, string $email, ?int $userId): void
    {
        $hasTarget = $this->inTenant($tenantId, function () use ($email, $userId): bool {
            $query = Target::query()->whereRaw('LOWER(email) = ?', [strtolower(trim($email))]);

            if ($userId !== null) {
                $query->orWhere('user_id', $userId);
            }

            return $query->exists();
        });

        if (! $hasTarget) {
            $this->assertCanCreateTargets($tenantId, 1);
        }
    }

    private function assertWithinLimit(string $tenantId, PlanLimit $limit, int $count): void
    {
        if ($count <= 0) {
            return;
        }

        $state = $this->stateFor($tenantId);

        if ($state['plan'] === null) {
            return;
        }

        if ($state['subscription']?->isReadOnly(now()) === true) {
            throw new PlanLimitReached($limit, 0, 0, subscriptionInactive: true);
        }

        $maximum = $state['plan']->limitFor($limit);

        if ($maximum === null) {
            return;
        }

        $usage = $this->usageFor($tenantId, $limit);

        if ($usage + $count > $maximum) {
            throw new PlanLimitReached($limit, $maximum, $usage);
        }
    }

    private function usageFor(string $tenantId, PlanLimit $limit): int
    {
        return match ($limit) {
            PlanLimit::Employees => $this->countEmployees($tenantId),
            PlanLimit::Users => $this->countUsers($tenantId),
        };
    }

    /**
     * Employees are active Targets in the tenant database.
     */
    private function countEmployees(string $tenantId): int
    {
        return $this->inTenant($tenantId, fn (): int => Target::query()->where('status', 'active')->count());
    }

    /**
     * Users are active memberships that are not linked to an employee Target (admins and other operators).
     */
    private function countUsers(string $tenantId): int
    {
        $linkedUserIds = $this->inTenant($tenantId, fn (): array => Target::query()
            ->whereNotNull('user_id')
            ->distinct()
            ->pluck('user_id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all());

        $memberships = TenantMembership::query()->forTenant($tenantId)->active();
        $total = (clone $memberships)->count();

        $linked = collect($linkedUserIds)
            ->chunk(self::LINKED_USER_CHUNK_SIZE)
            ->sum(fn (Collection $chunk): int => (clone $memberships)->whereIn('user_id', $chunk->all())->count());

        return max(0, $total - $linked);
    }

    /**
     * @return array{plan: SubscriptionPlan|null, subscription: TenantSubscription|null}
     */
    private function stateFor(string $tenantId): array
    {
        $subscription = TenantSubscription::query()
            ->with('plan')
            ->where('tenant_id', $tenantId)
            ->first();

        if ($subscription === null) {
            return ['plan' => $this->defaultPlan(), 'subscription' => null];
        }

        return [
            'plan' => $subscription->plan,
            'subscription' => $subscription,
        ];
    }

    /**
     * @return array{used: int, limit: int|null, over_limit: bool}
     */
    private function usageItem(int $used, ?int $limit): array
    {
        return [
            'used' => $used,
            'limit' => $limit,
            'over_limit' => $limit !== null && $used > $limit,
        ];
    }

    /**
     * The date that matters for the current state: the trial end while trialing, the term end while active.
     */
    private function relevantEnd(?TenantSubscription $subscription): ?CarbonInterface
    {
        return match ($subscription?->status) {
            SubscriptionStatus::Trial => $subscription->trial_ends_at,
            SubscriptionStatus::Active => $subscription->ends_at,
            default => null,
        };
    }

    private function defaultPlan(): ?SubscriptionPlan
    {
        return SubscriptionPlan::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first();
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function inTenant(string $tenantId, callable $callback): mixed
    {
        if (tenancy()->initialized && tenant('id') === $tenantId) {
            return $callback();
        }

        $tenant = Tenant::query()->findOrFail($tenantId);
        $previous = tenancy()->initialized ? tenancy()->tenant : null;

        Tenancy::initialize($tenant);

        try {
            return $callback();
        } finally {
            if ($previous !== null) {
                Tenancy::initialize($previous);
            } else {
                Tenancy::end();
            }
        }
    }
}
