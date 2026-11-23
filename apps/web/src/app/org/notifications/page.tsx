import { getTranslations } from "next-intl/server";
import { NotificationsClient } from "./notifications-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.notifications");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function NotificationsPage() {
  return <NotificationsClient />;
}
