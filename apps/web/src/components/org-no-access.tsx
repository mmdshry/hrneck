"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";

/** Shown in place of an org page the signed-in member has no permission to open. */
export function OrgNoAccess() {
  const t = useTranslations("orgNoAccess");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <EmptyState title={t("title")} description={t("body")} />
      <div>
        <LinkButton href="/org">{t("backToDashboard")}</LinkButton>
      </div>
    </div>
  );
}
