import { describe, expect, it } from "vitest";
import { notificationHref, type UserNotificationItem } from "./notifications";

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
    ).toBe("/learn");
    expect(
      notificationHref(item({ id: 3, type: "checklist_assigned", title: "C" })),
    ).toBe("/org/checklists/instances");
    expect(
      notificationHref(item({ id: 4, type: "ticket_assigned", title: "K" })),
    ).toBe("/org/ticketing");
  });
});
