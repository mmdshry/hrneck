import { describe, expect, it } from "vitest";
import {
  inboxPathFor,
  isInboxPath,
  notificationHref,
  type UserNotificationItem,
} from "./notifications";

function item(
  partial: Partial<UserNotificationItem> & Pick<UserNotificationItem, "id" | "type" | "title">,
): UserNotificationItem {
  return partial;
}

describe("notificationHref", () => {
  it("prefers explicit link", () => {
    expect(
      notificationHref(
        item({
          id: 1,
          type: "announcement",
          title: "Hi",
          data: { link: "/org/announcements" },
        }),
      ),
    ).toBe("/org/announcements");
  });

  it("maps types to default routes", () => {
    expect(
      notificationHref(item({ id: 2, type: "training_assigned", title: "T" })),
    ).toBe("/portal");
    expect(
      notificationHref(item({ id: 3, type: "checklist_assigned", title: "C" })),
    ).toBe("/org/checklists/instances");
    expect(
      notificationHref(item({ id: 4, type: "ticket_assigned", title: "K" })),
    ).toBe("/org/ticketing");
  });
});

describe("inboxPathFor", () => {
  it("opens the portal inbox from the employee area", () => {
    expect(inboxPathFor("/portal")).toBe("/portal/notifications");
    expect(inboxPathFor("/portal/tickets/12")).toBe("/portal/notifications");
  });

  it("opens the org inbox from the organization console", () => {
    expect(inboxPathFor("/org")).toBe("/org/notifications");
    expect(inboxPathFor("/org/roles")).toBe("/org/notifications");
  });

  it("does not treat similarly named paths as the employee area", () => {
    expect(inboxPathFor("/portalx")).toBe("/org/notifications");
  });
});

describe("isInboxPath", () => {
  it("matches both inbox pages and their sub-paths", () => {
    expect(isInboxPath("/org/notifications")).toBe(true);
    expect(isInboxPath("/portal/notifications")).toBe(true);
    expect(isInboxPath("/portal/notifications/5")).toBe(true);
  });

  it("ignores other pages", () => {
    expect(isInboxPath("/portal")).toBe(false);
    expect(isInboxPath("/org/notifications-archive")).toBe(false);
  });
});
