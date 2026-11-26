"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import { OrgShell } from "@/components/org-shell";
import { SidebarLanguageRow } from "@/components/sidebar-language-row";
import { buildPortalNav, type PortalNavLabels } from "@/lib/portal-nav";
import type { SessionUser } from "@/lib/session";

/** Employee area: same sidebar shell as /org, with the portal pages and permitted org menus. */
export function PortalChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");

  const labels = useMemo<PortalNavLabels>(
    () => ({
      myCourses: t("myCourses"),
      myTickets: t("myTickets"),
      knowledgeBase: t("knowledgeBase"),
      accountMfa: t("accountMfa"),
    }),
    [t],
  );

  const resolveNavItems = useCallback(
    (user: SessionUser | null) => buildPortalNav(user, labels),
    [labels],
  );

  return (
    <OrgShell resolveNavItems={resolveNavItems} footerExtras={<SidebarLanguageRow />}>
      <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>
    </OrgShell>
  );
}
