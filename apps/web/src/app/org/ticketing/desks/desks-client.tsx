"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { SdDesk } from "../ticketing-types";

export function DesksClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<SdDesk | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const list = await api(`/api/v1/org/ticketing/desks?${paginationQuery(nextPage, nextPerPage)}`, {
      tenant,
    });
    const parsed = parsePaginatedResponse<SdDesk>(list, nextPerPage);
    setDesks(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }

  async function openDesk(id: number) {
    await ensureCsrf();
    const detail = await api<{ data: SdDesk }>(`/api/v1/org/ticketing/desks/${id}`, {
      tenant: resolveTenant(),
    });
    setSelected(detail.data);
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.admin") && !hasPermission(session, "org.ticketing.tickets")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Desks" description="Desk definitions." />
        <Alert>Insufficient permissions.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Desks"
        description="ITIL desk definitions, stages, procedures, and SLA policies."
        actions={<LinkButton href="/org/ticketing" variant="outline">Queue</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="All desks">
          <ul className="space-y-2">
            {desks.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="w-full rounded border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--muted)]/10"
                  onClick={() => void openDesk(d.id)}
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {d.type} · {d.slug} {d.is_active ? "" : "(inactive)"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Pagination
            className="mt-3"
            page={page}
            perPage={perPage}
            total={meta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </Panel>
        <Panel title={selected ? selected.name : "Detail"}>
          {!selected ? (
            <p className="text-sm text-[var(--muted-foreground)]">Select a desk.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium mb-1">Stages</div>
                <ul className="list-disc pl-5">
                  {(selected.stages ?? []).map((s) => (
                    <li key={s.id}>
                      {s.name}
                      {s.default_escalation_minutes ? ` · escalate ${s.default_escalation_minutes}m` : ""}
                      {s.is_terminal ? " · terminal" : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Procedures</div>
                <ul className="list-disc pl-5">
                  {(selected.procedures ?? []).map((p) => (
                    <li key={p.id}>
                      {p.name} ({p.hook}) {p.is_active ? "" : "· inactive"}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">SLA</div>
                <ul className="list-disc pl-5">
                  {(selected.sla_policies ?? []).map((p) => (
                    <li key={p.id}>
                      {p.name} {p.is_default ? "(default)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
