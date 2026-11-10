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
  if (denial.kind === "org_mismatch") {
    const href = tenantWorkspaceUrl(denial.homeTenant, pathname, { search });
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          You do not belong to this organization
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          This workspace is <strong>{currentTenant}</strong>, but your account
          belongs to <strong>{denial.homeTenant}</strong>. Open your organization
          to continue.
        </p>
        <div>
          <LinkButton href={href}>{`Go to ${denial.homeTenant}`}</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
        Enter an organization first
      </h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Platform staff must open a tenant from Organizations before using{" "}
        <strong>{currentTenant}</strong> admin pages.
      </p>
      <div>
        <LinkButton href="/msp">Go to Organizations</LinkButton>
      </div>
    </div>
  );
}
