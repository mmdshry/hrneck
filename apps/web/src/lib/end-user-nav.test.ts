import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/session";
import {
  isEndUserNavActive,
  TECHNICIAN_PERMISSIONS,
  visibleEndUserNav,
  type EndUserNavItem,
} from "./end-user-nav";

function user(
  permissions: string[],
  learnerPortal?: boolean,
): SessionUser {
  return {
    id: 7,
    name: "Learner",
    email: "learner@itneck.test",
    tenant_id: "itneck",
    roles: ["learner"],
    permissions,
    is_platform_staff: false,
    ...(learnerPortal === undefined
      ? {}
      : {
          subscription: {
            plan_name: "Growth",
            status: "active",
            effective_status: "active",
            read_only: false,
            ends_at: null,
            over_limit: false,
            usage: {
              employees: { used: 1, limit: null, over_limit: false },
              users: { used: 1, limit: null, over_limit: false },
            },
            features: { learner_portal: learnerPortal },
          },
        }),
  };
}

const items: EndUserNavItem[] = [
  { href: "/portal", label: "My courses", exact: true, requiresLearnerPortal: true },
  {
    href: "/org/ticketing",
    label: "Technician",
    requiresAnyPermission: TECHNICIAN_PERMISSIONS,
  },
];

describe("visibleEndUserNav", () => {
  it("keeps unrestricted items for a signed-out viewer", () => {
    expect(visibleEndUserNav(items, null).map((item) => item.label)).toEqual([
      "My courses",
    ]);
  });

  it("hides permission-gated items the user lacks", () => {
    expect(
      visibleEndUserNav(items, user(["org.training.view"])).map(
        (item) => item.label,
      ),
    ).toEqual(["My courses"]);
  });

  it("shows a gated item when any one of its permissions is held", () => {
    expect(
      visibleEndUserNav(items, user(["org.ticketing.admin"])).map(
        (item) => item.label,
      ),
    ).toEqual(["My courses", "Technician"]);
  });

  it("preserves declared order", () => {
    const reversed = [...items].reverse();
    expect(
      visibleEndUserNav(reversed, user(["org.ticketing.tickets"])).map(
        (item) => item.label,
      ),
    ).toEqual(["Technician", "My courses"]);
  });

  it("hides My courses when the plan does not include the learner portal", () => {
    expect(
      visibleEndUserNav(items, user(["org.ticketing.portal"], false)).map(
        (item) => item.label,
      ),
    ).toEqual([]);
  });

  it("shows My courses when the plan includes the learner portal", () => {
    expect(
      visibleEndUserNav(items, user(["org.ticketing.portal"], true)).map(
        (item) => item.label,
      ),
    ).toEqual(["My courses"]);
  });
});

describe("isEndUserNavActive", () => {
  it("matches the exact route", () => {
    expect(isEndUserNavActive("/portal/kb", "/portal/kb")).toBe(true);
  });

  it("matches nested routes under the item", () => {
    expect(isEndUserNavActive("/portal/tickets/12", "/portal/tickets")).toBe(
      true,
    );
  });

  it("does not match a sibling that only shares a prefix", () => {
    expect(isEndUserNavActive("/portal/ticketsx", "/portal/tickets")).toBe(
      false,
    );
    expect(isEndUserNavActive("/portal/kb", "/portal/tickets")).toBe(false);
  });

  it("matches an exact item only on its own path, not on nested portal routes", () => {
    expect(isEndUserNavActive("/portal", "/portal", true)).toBe(true);
    expect(isEndUserNavActive("/portal/tickets", "/portal", true)).toBe(false);
  });
});
