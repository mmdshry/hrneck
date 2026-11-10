"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { orgLiveChannel } from "@/lib/live-topics";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
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
  port?: number;
  username: string;
  is_active: boolean;
  last_polled_at?: string | null;
};

type ReadersPayload = {
  data: Reader[];
};

function matchesCells(
  q: string,
  columnFilters: Record<string, string>,
  cells: Record<string, string>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle && !Object.values(cells).join(" ").toLowerCase().includes(needle)) {
    return false;
  }
  for (const [key, raw] of Object.entries(columnFilters)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
  }
  return true;
}

function readerCells(reader: Reader): Record<string, string> {
  return {
    name: reader.name,
    username: reader.username,
    host: reader.host,
    active: reader.is_active ? "1" : "0",
  };
}

const emptyForm = {
  name: "",
  desk_id: "",
  host: "127.0.0.1",
  port: "993",
  username: "",
  password: "",
  is_active: true,
};

export function EmailClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "email-readers") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [liveReaders, setLiveReaders] = useState<Reader[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Reader | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const applyLiveSlice = useCallback(
    (
      items: Reader[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((reader) =>
        matchesCells(q, columnFilters, readerCells(reader)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setReaders(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: ReadersPayload) => {
    setLiveReaders(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const loadDesksOnce = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;
    const t = resolveTenant();
    const deskList = await api(`/api/v1/org/ticketing/desks?${paginationQuery(1, 100)}`, {
      tenant: t,
    });
    const deskParsed = parsePaginatedResponse<SdDesk>(deskList, 100);
    const deskItems = deskParsed.data.filter((d) => d.type !== "kb");
    setDesks(deskItems);
    setForm((f) => {
      if (f.desk_id || !deskItems[0]) return f;
      return {
        ...f,
        desk_id: String(deskItems.find((d) => d.type === "incident")?.id ?? deskItems[0].id),
      };
    });
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      setSession(me);
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const list = await api(
        `/api/v1/org/ticketing/email-readers?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: t },
      );
      const parsed = parsePaginatedResponse<Reader>(list, nextPerPage);
      setReaders(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<ReadersPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void loadDesksOnce().catch(() => {
      /* readers bootstrap may still succeed */
    });
  }, [loadDesksOnce]);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveReaders !== null) {
      applyLiveSlice(
        liveReaders,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [
    liveReaders,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function afterMutation() {
    if (liveReaders === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  function startEdit(reader: Reader) {
    setEditingId(reader.id);
    setForm({
      name: reader.name,
      desk_id: String(reader.desk_id),
      host: reader.host,
      port: String(reader.port ?? 993),
      username: reader.username,
      password: "",
      is_active: reader.is_active,
    });
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      desk_id: desks[0]
        ? String(desks.find((d) => d.type === "incident")?.id ?? desks[0].id)
        : "",
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      if (editingId !== null) {
        const payload: Record<string, unknown> = {
          name: form.name,
          desk_id: Number(form.desk_id),
          host: form.host,
          port: Number(form.port),
          username: form.username,
          encryption: "ssl",
          is_active: form.is_active,
        };
        if (form.password.trim()) {
          payload.password = form.password;
        }
        await api(`/api/v1/org/ticketing/email-readers/${editingId}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Email reader updated.");
      } else {
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
            is_active: form.is_active,
          }),
        });
        setMessage("Email reader created.");
        setPage(1);
      }
      resetForm();
      await afterMutation();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteReader(reader: Reader) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/email-readers/${reader.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    if (editingId === reader.id) resetForm();
    setMessage("Email reader deleted.");
    await afterMutation();
  }

  async function ingestTest(readerId: number) {
    try {
      await ensureCsrf();
      const res = await api<{ data: { number: string } }>(
        `/api/v1/org/ticketing/email-readers/${readerId}/ingest`,
        {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "user@example.com",
            subject: "Printer offline",
            body: "Cannot print from floor 2.",
          }),
        },
      );
      setMessage(`Ingested as ${res.data.number}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ingest failed");
    }
  }

  const columns: Array<DataTableColumn<Reader>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (reader) => reader.name,
    },
    {
      id: "username",
      header: "Username",
      accessorKey: "username",
      cell: (reader) => reader.username,
    },
    {
      id: "host",
      header: "Host",
      accessorKey: "host",
      cell: (reader) => reader.host,
    },
    {
      id: "active",
      header: "Active",
      filter: "select",
      filterOptions: [
        { label: "Active", value: "1" },
        { label: "Inactive", value: "0" },
      ],
      filterValue: (reader) => (reader.is_active ? "1" : "0"),
      enableSorting: false,
      cell: (reader) => (reader.is_active ? "Active" : "Inactive"),
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (reader) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => startEdit(reader)}>
            Edit
          </Button>
          <Button type="button" variant="outline" onClick={() => void ingestTest(reader.id)}>
            Ingest test mail
          </Button>
          <Button type="button" variant="outline" onClick={() => setPendingDelete(reader)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

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
        description={
          statusLabel
            ? `Convert inbound mailbox messages into tickets. · ${statusLabel}`
            : "Convert inbound mailbox messages into tickets."
        }
        actions={<LinkButton href="/org/ticketing" variant="outline">Queue</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      {liveError ? <Alert variant="destructive">{liveError}</Alert> : null}
      <Panel title={editingId !== null ? "Edit reader" : "Add reader"}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
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
            <Label htmlFor="email-reader-password">
              Password{editingId !== null ? " (leave blank to keep)" : ""}
            </Label>
            <Input
              id="email-reader-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={editingId === null}
            />
          </div>
          {editingId !== null ? (
            <div className="space-y-1">
              <Label htmlFor="email-reader-active">Active</Label>
              <Select
                id="email-reader-active"
                value={form.is_active ? "1" : "0"}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit">{editingId !== null ? "Save changes" : "Save reader"}</Button>
            {editingId !== null ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>
      <Panel title="Configured">
        <DataTable
          mode="server"
          caption="Email readers"
          columns={columns}
          rows={readers}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle="No readers yet."
          pagination={{
            page,
            perPage,
            total: meta.total,
            onPageChange: setPage,
            onPerPageChange: (size) => {
              setPerPage(size);
              setPage(1);
            },
          }}
        />
      </Panel>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete email reader"
        description={`Delete email reader ${pendingDelete?.name ?? ""}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteReader(pendingDelete);
        }}
      />
    </div>
  );
}
