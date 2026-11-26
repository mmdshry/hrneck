"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ensureCsrf, fetchSessionUser } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import { MyCoursesSection } from "./my-courses-section";

/**
 * Employee home: assigned courses, service-portal tickets and the knowledge base.
 * "My courses" is hidden when the plan does not include the learner portal.
 */
export function EmployeeDashboard() {
  const t = useTranslations("portal");
  const [session, setSession] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        setSession(await fetchSessionUser());
      } catch {
        setSession(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return <PageSkeleton className="px-0 py-0" variant="detail" />;
  }

  const learnerPortalEnabled = session?.subscription?.features?.learner_portal !== false;

  return (
    <div className="min-w-0 space-y-10">
      <PageHeader title={t("dashboardTitle")} description={t("dashboardDescription")} />

      {learnerPortalEnabled ? (
        <section aria-labelledby="portal-my-courses" className="space-y-4">
          <h2 id="portal-my-courses" className="text-xl font-medium">
            {t("myCourses")}
          </h2>
          <MyCoursesSection />
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <DashboardLinkCard
          href="/portal/tickets"
          title={t("myTickets")}
          description={t("myTicketsDescription")}
          actionLabel={t("openMyTickets")}
        />
        <DashboardLinkCard
          href="/portal/kb"
          title={t("knowledgeBase")}
          description={t("knowledgeBaseDescription")}
          actionLabel={t("browseKnowledgeBase")}
        />
      </div>
    </div>
  );
}

function DashboardLinkCard({
  href,
  title,
  description,
  actionLabel,
}: {
  href: string;
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border)] p-5">
      <div className="space-y-2">
        <h2 className="text-xl font-medium">{title}</h2>
        <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-11 w-fit items-center text-sm font-medium underline underline-offset-4"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
