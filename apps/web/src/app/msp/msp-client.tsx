"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { clearTenant, setTenant } from "@/lib/tenant";

type TenantRow = {
  id: string;
  name: string;
  industry?: string | null;
  employee_band?: string | null;
  status: string;
  training_enabled: boolean;
  domains?: string[];
};

type MspPayload = {
  data: TenantRow[];
};

export function MspClient() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [liveTenants, setLiveTenants] = useState<TenantRow[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyLiveSlice = useCallback((items: TenantRow[], nextPage: number, nextPerPage: number) => {
    const sliced = paginateLocal(items, nextPage, nextPerPage);
    setTenants(sliced.data);
    setMeta(sliced.meta);
    setPage(sliced.meta.current_page);
  }, []);

  const onPayload = useCallback((payload: MspPayload) => {
    setLiveTenants(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshFromApi = useCallback(async (nextPage: number, nextPerPage: number) => {
    await ensureCsrf();
    const res = await api(`/api/v1/msp/tenants?${paginationQuery(nextPage, nextPerPage)}`);
    const parsed = parsePaginatedResponse<TenantRow>(res, nextPerPage);
    setTenants(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }, []);

  const { status, error } = useLiveTopic<MspPayload>({
    channel: "msp.live",
    onPayload,
  });

  useEffect(() => {
    if (liveTenants !== null) {
      applyLiveSlice(liveTenants, page, perPage);
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage)
      .catch(() => {
        /* live channel may still populate */
      })
      .finally(() => setLoading(false));
  }, [liveTenants, page, perPage, applyLiveSlice, refreshFromApi]);

  const statusLabel = liveStatusLabel(status);

  async function signOut() {
    setSigningOut(true);
    try {
      await ensureCsrf();
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      /* already signed out */
    } finally {
      clearTenant();
      setSigningOut(false);
      router.push("/login");
    }
  }

  const listEmpty = tenants.length === 0 && meta.total === 0;

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Organizations"
        description="MSP workspace for every managed tenant."
        actions={
          <Button
            type="button"
            variant="ghost"
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        }
      />
      <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        MSP workspace
        {statusLabel ? ` · ${statusLabel}` : " · Live"}
      </p>
      {error ? (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      ) : null}
      {listEmpty && status === "live" ? (
        <EmptyState
          className="mt-8"
          title="No organizations yet"
          description="Create a tenant in the admin panel."
        />
      ) : listEmpty ? (
        <p className="mt-8 text-sm text-[var(--muted-foreground)]">
          {statusLabel ?? "Waiting for live data…"}
        </p>
      ) : (
        <>
          <ul className="mt-8 space-y-3">
            {tenants.map((tenant) => (
              <li key={tenant.id}>
                <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-medium">{tenant.name}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {tenant.id}.hrneck.test · {tenant.industry ?? "—"} ·{" "}
                      {tenant.employee_band ?? "—"} · {tenant.status}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      Training {tenant.training_enabled ? "on" : "off"}
                    </p>
                  </div>
                  <LinkButton
                    href={`/org?tenant=${tenant.id}`}
                    variant="secondary"
                    onClick={() => setTenant(tenant.id)}
                  >
                    Open tenant admin
                  </LinkButton>
                </Panel>
              </li>
            ))}
          </ul>
          <Pagination
            className="mt-4"
            page={page}
            perPage={perPage}
            total={meta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
