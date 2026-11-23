import { getTranslations } from "next-intl/server";
import { TrainingCampaignsClient } from "./training-campaigns-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.campaigns");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function TrainingCampaignsPage() {
  return <TrainingCampaignsClient />;
}
