"use client";

import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import type { SessionSubscription, SubscriptionStatus } from "@/lib/session";

type SubscriptionNoticeProps = {
  subscription: SessionSubscription | null | undefined;
};

const STATUS_MESSAGE_KEYS = {
  trial: "statuses.trial",
  active: "statuses.active",
  suspended: "statuses.suspended",
  expired: "statuses.expired",
} as const satisfies Record<SubscriptionStatus, string>;

/**
 * Org-wide notices: a read-only subscription (writes are blocked) and usage above the plan limit.
 * Renders nothing when the organization is writable and within its limits.
 */
export function SubscriptionNotice({ subscription }: SubscriptionNoticeProps) {
  const t = useTranslations("org.subscription");

  if (!subscription) {
    return null;
  }

  const overLimit = [
    subscription.usage.employees.over_limit ? t("employees") : null,
    subscription.usage.users.over_limit ? t("users") : null,
  ].filter((label): label is string => label !== null);

  if (!subscription.read_only && overLimit.length === 0) {
    return null;
  }

  const status = subscription.effective_status ?? subscription.status ?? "expired";

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3">
      {subscription.read_only ? (
        <Alert variant="destructive">
          {t("readOnlyBanner", { status: t(STATUS_MESSAGE_KEYS[status]) })}
        </Alert>
      ) : null}
      {overLimit.length > 0 ? (
        <Alert role="status">
          {t("overLimitBanner", { resources: overLimit.join(", ") })}
        </Alert>
      ) : null}
    </div>
  );
}
