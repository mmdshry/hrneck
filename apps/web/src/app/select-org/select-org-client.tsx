"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  activeMemberships,
  resolvePostLoginPath,
  type OrgMembership,
  type SessionUser,
} from "@/lib/session";
import { setTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

export function SelectOrgClient() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);

  useEffect(() => {
    void fetchSessionUser()
      .then((user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        if (user.is_platform_staff) {
          router.replace("/msp");
          return;
        }
        const list = activeMemberships(user);
        if (list.length === 0) {
          toastError(t("selectOrgEmpty"));
          setLoading(false);
          return;
        }
        if (list.length === 1 && !user.needs_org_selection) {
          const only = list[0];
          setTenant(only.tenant_id);
          const next = safeNextPath(searchParams.get("next"));
          router.replace(resolvePostLoginPath({ ...user, needs_org_selection: false }, next));
          return;
        }
        setMemberships(list);
        setLoading(false);
      })
      .catch((err) => {
        toastError(err instanceof Error ? err.message : t("selectOrgLoadFailed"));
        setLoading(false);
      });
  }, [router, searchParams, t]);

  async function enterOrg(tenantId: string) {
    setEntering(tenantId);
    try {
      await ensureCsrf();
      const result = await api<{ data?: SessionUser }>(
        `/api/v1/auth/orgs/${encodeURIComponent(tenantId)}/enter`,
        { method: "POST" },
      );
      const user = result.data;
      setTenant(tenantId);
      const next = safeNextPath(searchParams.get("next"));
      router.push(
        user
          ? resolvePostLoginPath({ ...user, needs_org_selection: false }, next)
          : "/org",
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("selectOrgEnterFailed"));
      setEntering(null);
    }
  }

  return (
    <div
      className="mt-6 rounded-[var(--radius)] border border-[var(--border)] border-t-2 bg-[var(--card)] px-6 py-8 shadow-[var(--shadow-sm)]"
      style={{ borderTopColor: "var(--spark)" }}
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {t("selectOrgTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {t("selectOrgDescription")}
      </p>
{loading ? (
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">{tCommon("loading")}</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {memberships.map((m) => (
            <li key={m.tenant_id}>
              <Panel className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--foreground)]">
                    {m.name || m.tenant_id}
                  </p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {m.tenant_id}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={entering !== null}
                  onClick={() => void enterOrg(m.tenant_id)}
                >
                  {entering === m.tenant_id ? tCommon("opening") : t("selectOrgContinue")}
                </Button>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/login" className="underline-offset-4 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
