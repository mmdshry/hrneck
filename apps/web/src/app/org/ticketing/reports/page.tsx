import { getTranslations } from "next-intl/server";
import { ReportsClient } from "./reports-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.ticketing");
  return {
    title: t("reportsTitle"),
    description: t("reportsDescription"),
  };
}
export default function TicketingReportsPage() {
  return <ReportsClient />;
}
