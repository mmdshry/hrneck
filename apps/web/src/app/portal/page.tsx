import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmployeeDashboard } from "./employee-dashboard";

export async function generateMetadata() {
  const t = await getTranslations("portal");
  return {
    title: t("dashboardTitle"),
  };
}

export default function PortalPage() {
  return (
    <Suspense fallback={<PageSkeleton className="px-0 py-0" variant="detail" />}>
      <EmployeeDashboard />
    </Suspense>
  );
}
