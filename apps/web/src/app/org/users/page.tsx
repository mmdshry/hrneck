import { getTranslations } from "next-intl/server";
import { UsersClient } from "./users-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.users");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function UsersPage() {
  return <UsersClient />;
}
