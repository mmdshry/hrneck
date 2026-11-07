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
import { toastError } from "@/lib/toast";

type Desk = { id: number; name: string; type: string };
type Ticket = { id: number; number: string; summary: string; stage?: { name: string } | null; status?: { name: string } | null };

export function PortalTicketsClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [deskId, setDeskId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    setAuthChecked(true);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const [deskList, list] = await Promise.all([
      api<{ data: Desk[] }>("/api/v1/org/portal/ticketing/desks", { tenant }),
      api(`/api/v1/org/portal/ticketing/tickets?${paginationQuery(nextPage, nextPerPage)}`, {
        tenant,
      }),
    ]);
    const parsed = parsePaginatedResponse<Ticket>(list, nextPerPage);
    setDesks(deskList.data ?? []);
    setTickets(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
    if (!deskId && deskList.data?.[0]) setDeskId(String(deskList.data[0].id));
  }

  useEffect(() => {
    void refresh().catch((err: unknown) =>
      toastError(err instanceof Error ? err.message : "Load failed"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      const created = await api<{ data: Ticket }>("/api/v1/org/portal/ticketing/tickets", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desk_id: Number(deskId), summary, description }),
      });
      setSummary("");
      setDescription("");
      window.location.href = `/portal/tickets/${created.data.id}`;
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Create failed");
    }
  }

  const canPortal = session ? hasPermission(session, "org.ticketing.portal") : false;

  if (!authChecked) {
    return <PageSkeleton />;
  }

  if (authChecked && !session) {
    return (
      <div className="space-y-4">
        <PageHeader title="My tickets" description="End-user service portal." />
        <Alert>
          Sign in to view and submit portal tickets.{" "}
          <LinkButton href="/login?next=/portal/tickets" variant="link" size="sm" className="px-1">
            Sign in
          </LinkButton>
        </Alert>
      </div>
    );
  }

  if (session && !canPortal) {
    return (
      <div className="space-y-4">
        <PageHeader title="My tickets" description="End-user service portal." />
        <Alert>You need org.ticketing.portal to submit and view portal tickets.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My tickets" description="Submit requests and track open issues." />
      {canPortal ? (
        <Panel title="New request">
          <form className="space-y-3" onSubmit={onCreate}>
            <div className="space-y-1">
              <Label htmlFor="portal-desk">Desk</Label>
              <Select
                id="portal-desk"
                value={deskId}
                onChange={(e) => setDeskId(e.target.value)}
                required
              >
                {desks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="portal-summary">Summary</Label>
              <Input
                id="portal-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="portal-details">Details</Label>
              <Textarea
                id="portal-details"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <Button type="submit">Submit</Button>
          </form>
        </Panel>
      ) : null}
      <Panel title="Open tickets">
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <a className="underline-offset-2 hover:underline" href={`/portal/tickets/${t.id}`}>
                {t.number} · {t.summary}
              </a>
              <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                {t.stage?.name} / {t.status?.name}
              </span>
            </li>
          ))}
          {tickets.length === 0 ? <li className="text-sm text-[var(--muted-foreground)]">No tickets yet.</li> : null}
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
    </div>
  );
}
