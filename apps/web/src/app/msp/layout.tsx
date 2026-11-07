import { Suspense, type ReactNode } from "react";
import { OrgShell } from "@/components/org-shell";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function MspLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgShell>{children}</OrgShell>
    </Suspense>
  );
}
