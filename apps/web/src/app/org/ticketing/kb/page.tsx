import { getTranslations } from "next-intl/server";
import { KbClient } from "./kb-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.ticketing");
  return {
    title: t("knowledgeBase"),
    description: t("kbDescription"),
  };
}
export default function KbPage() {
  return <KbClient />;
}
