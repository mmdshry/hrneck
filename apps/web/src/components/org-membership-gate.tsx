"use client";

import { useTranslations } from "next-intl";
import { LinkButton } from "@/components/ui/link-button";
import type { OrgMembershipMatch } from "@/lib/session";
import { tenantWorkspaceUrl } from "@/lib/tenant";

type DeniedMembership = Extract<OrgMembershipMatch, { ok: false }>;

type OrgMembershipGateProps = {
  denial: DeniedMembership;
  currentTenant: string;
  pathname: string;
  search?: string;
};

export function OrgMembershipGate({
  denial,
  currentTenant,
  pathname,
  search = "",
}: OrgMembershipGateProps) {
  const t = useTranslations("account");

  if (denial.kind === "org_mismatch") {
    const href = tenantWorkspaceUrl(denial.homeTenant, pathname, { search });
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          {t("membershipMismatchTitle")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("membershipMismatchBody", {
            current: currentTenant,
            home: denial.homeTenant,
          })}
        </p>
        <div>
          <LinkButton href={href}>
            {t("goToTenant", { tenant: denial.homeTenant })}
          </LinkButton>
        </div>
      </div>
    );
  }

  if (denial.kind === "org_selection_required") {
    const next = encodeURIComponent(`${pathname}${search}`);
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          {t("selectOrgRequiredTitle")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("selectOrgRequiredBody", { tenant: currentTenant })}
        </p>
        <div>
          <LinkButton href={`/select-org?next=${next}`}>{t("chooseOrganization")}</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
        {t("enterOrgFirstTitle")}
      </h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        {t("enterOrgFirstBody", { tenant: currentTenant })}
      </p>
      <div>
        <LinkButton href="/msp">{t("goToOrganizations")}</LinkButton>
      </div>
    </div>
  );
}
