import { getTranslations } from "next-intl/server";
import { AnnouncementsClient } from "./announcements-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.announcements");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function AnnouncementsPage() {
  return <AnnouncementsClient />;
}
