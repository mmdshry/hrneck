import { getTranslations } from "next-intl/server";
import { ChecklistPackDetailClient } from "./pack-detail-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.checklists");
  return {
    title: t("packsTitle"),
  };
}
export default async function ChecklistPackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChecklistPackDetailClient packId={Number(id)} />;
}
