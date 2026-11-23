import { getTranslations } from "next-intl/server";
import { ChecklistBuilderClient } from "./builder-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.checklists");
  return {
    title: t("builderTitle"),
  };
}
export default async function ChecklistBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChecklistBuilderClient templateId={Number(id)} />;
}
