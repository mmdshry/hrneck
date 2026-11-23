import { getTranslations } from "next-intl/server";
import { IntegrationsClient } from "./integrations-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.settings");
  return {
    title: t("integrationsTitle"),
  };
}
export default function IntegrationsPage() {
  return <IntegrationsClient />;
}
