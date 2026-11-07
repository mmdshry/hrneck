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

type Reader = {
  id: number;
  name: string;
  desk_id: number;
  host: string;
  username: string;
  is_active: boolean;
  last_polled_at?: string | null;
};

export function EmailClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    desk_id: "",
    host: "127.0.0.1",
    port: "993",
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const [list, deskList] = await Promise.all([
      api(`/api/v1/org/ticketing/email-readers?${paginationQuery(nextPage, nextPerPage)}`, {
        tenant,
      }),
      api(`/api/v1/org/ticketing/desks?${paginationQuery(1, 100)}`, { tenant }),
    ]);
    const parsed = parsePaginatedResponse<Reader>(list, nextPerPage);
    const deskParsed = parsePaginatedResponse<SdDesk>(deskList, 100);
    setReaders(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
    const deskItems = deskParsed.data.filter((d) => d.type !== "kb");
    setDesks(deskItems);
    if (!form.desk_id && deskItems[0]) {
      setForm((f) => ({
        ...f,
        desk_id: String(deskItems.find((d) => d.type === "incident")?.id ?? deskItems[0].id),
      }));
    }
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/email-readers", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          desk_id: Number(form.desk_id),
          host: form.host,
          port: Number(form.port),
          username: form.username,
          password: form.password,
          encryption: "ssl",
          is_active: true,
        }),
      });
      setMessage("Email reader created.");
      setPage(1);
      await refresh(1, perPage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function ingestTest(readerId: number) {
    try {
      await ensureCsrf();
      const res = await api<{ data: { number: string } }>(`/api/v1/org/ticketing/email-readers/${readerId}/ingest`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "user@example.com",
          subject: "Printer offline",
          body: "Cannot print from floor 2.",
        }),
      });
      setMessage(`Ingested as ${res.data.number}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ingest failed");
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.admin")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Email readers" description="Inbound mail." />
        <Alert>You need org.ticketing.admin.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Email readers"
        description="Convert inbound mailbox messages into tickets."
        actions={<LinkButton href="/org/ticketing" variant="outline">Queue</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      <Panel title="Add reader">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <div className="space-y-1">
            <Label htmlFor="email-reader-name">Name</Label>
            <Input
              id="email-reader-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-desk">Desk</Label>
            <Select
              id="email-reader-desk"
              value={form.desk_id}
              onChange={(e) => setForm({ ...form, desk_id: e.target.value })}
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
            <Label htmlFor="email-reader-host">Host</Label>
            <Input
              id="email-reader-host"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-port">Port</Label>
            <Input
              id="email-reader-port"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-username">Username</Label>
            <Input
              id="email-reader-username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-password">Password</Label>
            <Input
              id="email-reader-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div>
            <Button type="submit">Save reader</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Configured">
        <ul className="space-y-3">
          {readers.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border)] p-3">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {r.username}@{r.host} · {r.is_active ? "active" : "inactive"}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void ingestTest(r.id)}>
                Ingest test mail
              </Button>
            </li>
          ))}
          {readers.length === 0 ? <li className="text-sm text-[var(--muted-foreground)]">No readers yet.</li> : null}
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
