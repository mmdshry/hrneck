import { getTranslations } from "next-intl/server";
import { ChecklistFillClient } from "./fill-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.checklists");
  return {
    title: t("fillChecklist"),
  };
}
export default async function ChecklistFillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChecklistFillClient instanceId={Number(id)} />;
}
