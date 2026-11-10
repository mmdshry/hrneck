import { Suspense, type ReactNode } from "react";
import { OrgShell } from "@/components/org-shell";
import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Client OrgShell cannot participate in instant-nav validation. */
export const instant = false;

export default function MspLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgShell>{children}</OrgShell>
    </Suspense>
  );
}
