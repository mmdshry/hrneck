import { getTranslations } from "next-intl/server";
import { TargetsClient } from "./targets-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.employees");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function TargetsPage() {
  return <TargetsClient />;
}
