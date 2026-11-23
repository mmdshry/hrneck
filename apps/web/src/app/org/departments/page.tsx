import { getTranslations } from "next-intl/server";
import { DepartmentsClient } from "./departments-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.departments");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function DepartmentsPage() {
  return <DepartmentsClient />;
}
