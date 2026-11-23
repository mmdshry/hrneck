import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { MinimalLoader } from "@/components/ui/minimal-loader";

export const instant = false;

const TrainingHubClient = dynamic(
  () =>
    import("./training-hub-client").then((mod) => mod.TrainingHubClient),
  {
    loading: () => <MinimalLoader />,
  },
);

export async function generateMetadata() {
  const t = await getTranslations("org.training");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function TrainingPage() {
  return <TrainingHubClient />;
}
