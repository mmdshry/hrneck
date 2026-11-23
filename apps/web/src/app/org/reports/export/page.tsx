import { getTranslations } from "next-intl/server";
import { ReportExportClient } from "./export-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.export");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function ReportExportPage() {
  return <ReportExportClient />;
}
