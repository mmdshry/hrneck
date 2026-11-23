import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import { MinimalLoader } from "@/components/ui/minimal-loader";

export const instant = false;

const CoursesClient = dynamic(
  () => import("./courses-client").then((mod) => mod.CoursesClient),
  {
    loading: () => <MinimalLoader />,
  },
);

export async function generateMetadata() {
  const t = await getTranslations("org.courses");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function CoursesPage() {
  return <CoursesClient />;
}
