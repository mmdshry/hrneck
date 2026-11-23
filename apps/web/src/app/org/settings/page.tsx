import { getTranslations } from "next-intl/server";
import { SettingsClient } from "./settings-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.settings");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function SettingsPage() {
  return <SettingsClient />;
}
