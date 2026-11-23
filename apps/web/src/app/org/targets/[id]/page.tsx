import { getTranslations } from "next-intl/server";
import { TargetDetailClient } from "./target-detail-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.employees");
  return {
    title: t("title"),
  };
}
export default async function TargetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TargetDetailClient targetId={Number(id)} />;
}
