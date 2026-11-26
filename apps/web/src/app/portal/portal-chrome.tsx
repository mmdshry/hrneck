"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EndUserChrome } from "@/components/end-user-chrome";
import {
  TECHNICIAN_PERMISSIONS,
  type EndUserNavItem,
} from "@/lib/end-user-nav";

export function PortalChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");

  const navItems: EndUserNavItem[] = [
    {
      href: "/portal",
      label: t("myCourses"),
      exact: true,
      requiresLearnerPortal: true,
    },
    { href: "/portal/tickets", label: t("myTickets") },
    { href: "/portal/kb", label: t("knowledgeBase") },
    {
      href: "/org/ticketing",
      label: t("technician"),
      requiresAnyPermission: TECHNICIAN_PERMISSIONS,
    },
  ];

  return (
    <EndUserChrome
      brandHref="/portal"
      brandLabel={t("servicePortal")}
      navLabel={t("servicePortal")}
      navItems={navItems}
    >
      {children}
    </EndUserChrome>
  );
}
