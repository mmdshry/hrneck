import { getTranslations } from "next-intl/server";
import { ReportsClient } from "./reports-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.reports");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function ReportsPage() {
  return <ReportsClient />;
}
