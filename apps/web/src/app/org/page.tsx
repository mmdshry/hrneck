import { getTranslations } from "next-intl/server";
import { OrgDashboardClient } from "./org-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.dashboard");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function OrgAdminPage() {
  return <OrgDashboardClient />;
}
