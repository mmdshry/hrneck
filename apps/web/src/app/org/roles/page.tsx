import { getTranslations } from "next-intl/server";
import { RolesClient } from "./roles-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.roles");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function RolesPage() {
  return <RolesClient />;
}
