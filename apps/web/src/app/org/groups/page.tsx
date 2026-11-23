import { getTranslations } from "next-intl/server";
import { GroupsClient } from "./groups-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.groups");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function GroupsPage() {
  return <GroupsClient />;
}
