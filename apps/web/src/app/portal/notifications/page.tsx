import { getTranslations } from "next-intl/server";
import { NotificationsClient } from "@/app/org/notifications/notifications-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.notifications");
  return {
    title: t("title"),
    description: t("description"),
  };
}

/** Employee inbox: same component as /org/notifications, rendered inside the portal shell. */
export default function PortalNotificationsPage() {
  return <NotificationsClient />;
}
