import { getTranslations } from "next-intl/server";
import { ChecklistPacksClient } from "./packs-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.checklists");
  return {
    title: t("packsTitle"),
    description: t("packsDescription"),
  };
}
export default function ChecklistPacksPage() {
  return <ChecklistPacksClient />;
}
