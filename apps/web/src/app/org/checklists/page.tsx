import { getTranslations } from "next-intl/server";
import { ChecklistsClient } from "./checklists-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.checklists");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function ChecklistsPage() {
  return <ChecklistsClient />;
}
