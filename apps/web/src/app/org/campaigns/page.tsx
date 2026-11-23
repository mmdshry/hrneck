import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.campaigns");
  return {
    title: t("title"),
    description: t("description"),
  };
}
/** Canonical campaigns UI lives under Training; keep this path as a redirect. */
export default function CampaignsPage() {
  redirect("/org/training/campaigns");
}
