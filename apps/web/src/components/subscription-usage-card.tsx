"use client";

import { useLocale, useTranslations } from "next-intl";
import { Panel } from "@/components/ui/panel";
import type {
  SessionSubscription,
  SubscriptionStatus,
  SubscriptionUsageItem,
} from "@/lib/session";

type SubscriptionUsageCardProps = {
  subscription: SessionSubscription | null | undefined;
};

const STATUS_MESSAGE_KEYS = {
  trial: "statuses.trial",
  active: "statuses.active",
  suspended: "statuses.suspended",
  expired: "statuses.expired",
} as const satisfies Record<SubscriptionStatus, string>;

/** Plan, status, and seat usage against the plan limits. Shown on the organization settings page. */
export function SubscriptionUsageCard({ subscription }: SubscriptionUsageCardProps) {
  const t = useTranslations("org.subscription");
  const locale = useLocale();

  if (!subscription) {
    return null;
  }

  const status = subscription.effective_status ?? subscription.status;
  const endsLabel = subscription.ends_at
    ? new Date(subscription.ends_at).toLocaleDateString(locale)
    : null;

  return (
    <Panel title={t("usageTitle")} className="mt-8">
      <p className="text-sm text-[var(--muted-foreground)]">{t("usageDescription")}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {t("planLabel")}
          </dt>
          <dd className="mt-1 text-sm font-medium">{subscription.plan_name ?? t("noPlan")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {t("statusLabel")}
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {status ? t(STATUS_MESSAGE_KEYS[status]) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {t("endsLabel")}
          </dt>
          <dd className="mt-1 text-sm font-medium">{endsLabel ?? "—"}</dd>
        </div>
      </dl>
      <ul className="mt-6 space-y-4">
        <UsageRow label={t("employees")} item={subscription.usage.employees} />
        <UsageRow label={t("users")} item={subscription.usage.users} />
      </ul>
    </Panel>
  );
}

function UsageRow({ label, item }: { label: string; item: SubscriptionUsageItem }) {
  const t = useTranslations("org.subscription");
  const limit = item.limit;
  const hasBar = limit !== null && limit > 0;
  const percent = limit !== null && limit > 0 ? Math.min(100, Math.round((item.used / limit) * 100)) : 0;

  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-[var(--muted-foreground)]">
          {item.limit === null
            ? t("usedUnlimited", { used: item.used })
            : t("usedOfLimit", { used: item.used, limit: item.limit })}
        </span>
      </div>
      {hasBar ? (
        <div
          className="mt-2 h-2 overflow-hidden rounded bg-[var(--muted)]"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit ?? undefined}
          aria-valuenow={item.used}
        >
          <div
            className={item.over_limit ? "h-2 bg-[var(--destructive)]" : "h-2 bg-[var(--primary)]"}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {item.over_limit ? (
        <p className="mt-1 text-sm text-[var(--destructive)]">{t("overLimit")}</p>
      ) : null}
    </li>
  );
}
