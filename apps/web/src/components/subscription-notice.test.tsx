import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionSubscription } from "@/lib/session";
import { SubscriptionNotice } from "./subscription-notice";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values
      ? `${key} ${Object.entries(values)
          .map(([name, value]) => `${name}=${String(value)}`)
          .join(" ")}`
      : key,
}));

function subscription(overrides: Partial<SessionSubscription> = {}): SessionSubscription {
  return {
    plan_name: "Standard",
    status: "active",
    effective_status: "active",
    read_only: false,
    ends_at: null,
    over_limit: false,
    usage: {
      employees: { used: 3, limit: null, over_limit: false },
      users: { used: 2, limit: 5, over_limit: false },
    },
    ...overrides,
  };
}

describe("SubscriptionNotice", () => {
  it("renders nothing for a writable organization within its limits", () => {
    const { container } = render(<SubscriptionNotice subscription={subscription()} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no subscription is loaded", () => {
    const { container } = render(<SubscriptionNotice subscription={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("reports read-only organizations with the effective status, not the stored one", () => {
    render(
      <SubscriptionNotice
        subscription={subscription({ read_only: true, status: "trial", effective_status: "expired" })}
      />,
    );

    expect(screen.getByText("readOnlyBanner status=statuses.expired")).toBeTruthy();
  });

  it("warns when usage is over the plan limit and names the resource", () => {
    render(
      <SubscriptionNotice
        subscription={subscription({
          over_limit: true,
          usage: {
            employees: { used: 9, limit: 5, over_limit: true },
            users: { used: 2, limit: 5, over_limit: false },
          },
        })}
      />,
    );

    expect(screen.getByText("overLimitBanner resources=employees")).toBeTruthy();
    expect(screen.queryByText(/readOnlyBanner/)).toBeNull();
  });
});
