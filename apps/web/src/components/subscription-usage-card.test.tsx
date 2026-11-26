import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionSubscription } from "@/lib/session";
import { SubscriptionUsageCard } from "./subscription-usage-card";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values
      ? `${key} ${Object.entries(values)
          .map(([name, value]) => `${name}=${String(value)}`)
          .join(" ")}`
      : key,
}));

const subscription: SessionSubscription = {
  plan_name: "Growth",
  status: "active",
  effective_status: "active",
  read_only: false,
  ends_at: null,
  over_limit: true,
  usage: {
    employees: { used: 9, limit: 5, over_limit: true },
    users: { used: 2, limit: null, over_limit: false },
  },
};

describe("SubscriptionUsageCard", () => {
  it("shows the plan, the status, and usage against each limit", () => {
    render(<SubscriptionUsageCard subscription={subscription} />);

    expect(screen.getByText("Growth")).toBeTruthy();
    expect(screen.getByText("statuses.active")).toBeTruthy();
    expect(screen.getByText("usedOfLimit used=9 limit=5")).toBeTruthy();
    expect(screen.getByText("usedUnlimited used=2")).toBeTruthy();
    expect(screen.getByText("overLimit")).toBeTruthy();
  });

  it("marks the employee bar with its current usage", () => {
    render(<SubscriptionUsageCard subscription={subscription} />);

    const bar = screen.getByRole("progressbar", { name: "employees" });
    expect(bar.getAttribute("aria-valuenow")).toBe("9");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");
  });

  it("renders nothing without a subscription", () => {
    const { container } = render(<SubscriptionUsageCard subscription={undefined} />);

    expect(container.firstChild).toBeNull();
  });
});
