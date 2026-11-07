"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { notifyResult, toastError, toastInfo, toastSuccess } from "@/lib/toast";
import type { SdDesk, SdTicket } from "./ticketing-types";

export function TicketingQueueClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [tickets, setTickets] = useState<SdTicket[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [q, setQ] = useState("");
  const [deskId, setDeskId] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [createDeskId, setCreateDeskId] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const params = paginationQuery(nextPage, nextPerPage, {
      q: q || undefined,
      desk_id: deskId || undefined,
    });
    const [list, deskList] = await Promise.all([
      api(`/api/v1/org/ticketing/tickets?${params}`, { tenant }),
      api<{ data: SdDesk[] }>("/api/v1/org/ticketing/desks?per_page=100", { tenant }),
    ]);
    const parsed = parsePaginatedResponse<SdTicket>(list, nextPerPage);
    setTickets(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
    setPerPage(parsed.meta.per_page as PageSize);
    const activeDesks = (deskList.data ?? []).filter((d) => d.type !== "kb");
    setDesks(activeDesks);
    const preferred =
      activeDesks.find((d) => d.type === "incident")?.id ?? activeDesks[0]?.id;
    if (preferred) {
      setCreateDeskId((prev) => prev || String(preferred));
    }
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const desk = Number(createDeskId);
    if (!desk) {
      toastInfo("Select a desk before creating a ticket.");
      return;
    }
    try {
      await ensureCsrf();
      const created = await api<{ data: SdTicket }>("/api/v1/org/ticketing/tickets", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: desk,
          summary,
          description: description || null,
        }),
      });
      setSummary("");
      setDescription("");
      toastSuccess(`Created ${created.data.number}`);
      window.location.assign(`/org/ticketing/tickets/${created.data.id}`);
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function bulk(action: string) {
    if (selected.length === 0) return;
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/tickets/bulk", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selected }),
      });
      setSelected([]);
      toastSuccess(`Bulk ${action} complete.`);
      await refresh();
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Bulk failed");
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.tickets")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Ticketing" description="Service desk queue." />
        <Alert>You need org.ticketing.tickets to work tickets.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Ticketing"
        description="Incidents, problems, service requests, and changes."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/ticketing/search" variant="outline">
              Search all
            </LinkButton>
            <LinkButton href="/org/ticketing/kb" variant="outline">
              Knowledge base
            </LinkButton>
            <LinkButton href="/org/ticketing/desks" variant="outline">
              Desks
            </LinkButton>
            <LinkButton href="/org/ticketing/email" variant="outline">
              Email
            </LinkButton>
            <LinkButton href="/org/ticketing/reports" variant="outline">
              Reports
            </LinkButton>
            <LinkButton href="/portal/tickets" variant="outline">
              Portal
            </LinkButton>
          </div>
        }
      />


      <Panel title="New ticket">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <div className="space-y-1">
            <Label htmlFor="desk">Desk</Label>
            <Select id="desk" value={createDeskId} onChange={(e) => setCreateDeskId(e.target.value)} required>
              {desks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="summary">Summary</Label>
            <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} required />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Button type="submit">Create ticket</Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Queue"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void bulk("archive")}>
              Archive
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("read")}>
              Mark read
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("link")}>
              Link
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("unlock")}>
              Unlock
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            aria-label="Search tickets"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Select
            aria-label="Filter by desk"
            value={deskId}
            onChange={(e) => setDeskId(e.target.value)}
            className="max-w-xs"
          >
            <option value="">All desks</option>
            {desks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPage(1);
              void refresh(1, perPage).catch((err: unknown) => {
                toastError(err instanceof Error ? err.message : "Load failed");
              });
            }}
          >
            Filter
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Service desk ticket queue</caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th scope="col" className="w-8 p-2">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="p-2">
                  Number
                </th>
                <th scope="col" className="p-2">
                  Summary
                </th>
                <th scope="col" className="p-2">
                  Desk
                </th>
                <th scope="col" className="p-2">
                  Stage
                </th>
                <th scope="col" className="p-2">
                  Priority
                </th>
                <th scope="col" className="p-2">
                  SLA
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border)]/60">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ticket ${t.number}`}
                      checked={selected.includes(t.id)}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                        );
                      }}
                    />
                  </td>
                  <td className="p-2 font-medium">
                    <a className="underline-offset-2 hover:underline" href={`/org/ticketing/tickets/${t.id}`}>
                      {t.number}
                    </a>
                  </td>
                  <td className="p-2">{t.summary}</td>
                  <td className="p-2">{t.desk?.name}</td>
                  <td className="p-2">{t.stage?.name}</td>
                  <td className="p-2">{t.priority?.name}</td>
                  <td className="p-2">
                    {t.sla_response_breached || t.sla_resolve_breached ? "Breach" : "OK"}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-[var(--muted-foreground)]">
                    No tickets yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
