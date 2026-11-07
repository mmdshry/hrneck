import { Suspense, type ReactNode } from "react";
import { DocsChrome } from "@/components/guides/docs-chrome";
import { OrgShell } from "@/components/org-shell";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <OrgShell>
        <DocsChrome>{children}</DocsChrome>
      </OrgShell>
    </Suspense>
  );
}
