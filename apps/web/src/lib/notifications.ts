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

export function notificationHref(item: UserNotificationItem): string {
  const link = item.data?.link;
  if (typeof link === "string" && link.startsWith("/")) {
    return link;
  }
  switch (item.type) {
    case "training_assigned":
      return "/learn";
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
