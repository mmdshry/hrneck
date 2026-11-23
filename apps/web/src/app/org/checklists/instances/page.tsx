import { getTranslations } from "next-intl/server";
import { ChecklistInstancesClient } from "./instances-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.checklists");
  return {
    title: t("instancesTitle"),
    description: t("instancesDescription"),
  };
}
export default function ChecklistInstancesPage() {
  return <ChecklistInstancesClient />;
}
