export type UserNotificationItem = {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  data?: {
    link?: string;
    entity_id?: number;
    [key: string]: unknown;
  } | null;
  read_at?: string | null;
  created_at?: string | null;
};

export type NotificationsResponse = {
  data: UserNotificationItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    unread_count: number;
  };
};

/** Organization console inbox. */
export const ORG_INBOX_PATH = "/org/notifications";

/** Employee inbox, rendered inside the learner portal shell. */
export const PORTAL_INBOX_PATH = "/portal/notifications";

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Inbox the notification bell opens. Viewers in the employee area get the portal copy,
 * so they never land in the organization console.
 */
export function inboxPathFor(pathname: string): string {
  return isUnder(pathname, "/portal") ? PORTAL_INBOX_PATH : ORG_INBOX_PATH;
}

/** True on either inbox page, so the bell can show its active state. */
export function isInboxPath(pathname: string): boolean {
  return (
    isUnder(pathname, ORG_INBOX_PATH) || isUnder(pathname, PORTAL_INBOX_PATH)
  );
}

export function notificationHref(item: UserNotificationItem): string {
  const link = item.data?.link;
  if (typeof link === "string" && link.startsWith("/")) {
    return link;
  }
  switch (item.type) {
    case "training_assigned":
      return "/portal";
    case "checklist_assigned":
      return "/org/checklists/instances";
    case "ticket_assigned":
      return "/org/ticketing";
    case "announcement":
      return "/org";
    default:
      return "/org";
  }
}
