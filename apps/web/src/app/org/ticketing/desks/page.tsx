import { getTranslations } from "next-intl/server";
import { DesksClient } from "./desks-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.ticketing");
  return {
    title: t("desks"),
    description: t("desksDescription"),
  };
}
export default function DesksPage() {
  return <DesksClient />;
}
