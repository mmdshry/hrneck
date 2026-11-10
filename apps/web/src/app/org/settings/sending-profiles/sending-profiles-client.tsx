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
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";

type Profile = {
  id: number;
  name: string;
  from_name: string;
  from_email: string;
  mailer: string;
  is_default: boolean;
};

type ProfilesPayload = {
  data: Profile[];
};

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid)\b/.test(m) ||
    m.includes("load failed") ||
    m.includes("save failed")
  ) {
    return "destructive";
  }
  if (m.includes("saved")) return "success";
  return "default";
}

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

function profileCells(profile: Profile): Record<string, string> {
  return {
    name: profile.name,
    from_name: profile.from_name,
    from_email: profile.from_email,
    mailer: profile.mailer,
  };
}

export function SendingProfilesClient() {
  const tenant = resolveTenant();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [liveProfiles, setLiveProfiles] = useState<Profile[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [name, setName] = useState("Default SMTP");
  const [fromName, setFromName] = useState("HRNECK");
  const [fromEmail, setFromEmail] = useState("noreply@hrneck.com");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const channel = useMemo(() => `org.${tenant}.sending-profiles`, [tenant]);

  const applyLiveSlice = useCallback(
    (
      items: Profile[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((profile) =>
        matchesCells(q, columnFilters, profileCells(profile)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setProfiles(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: ProfilesPayload) => {
    const items = Array.isArray(payload.data) ? payload.data : [];
    setLiveProfiles(items);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const res = await api(
        `/api/v1/org/sending-profiles?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        {
          tenant: resolveTenant(),
        },
      );
      const parsed = parsePaginatedResponse<Profile>(res, nextPerPage);
      setProfiles(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<ProfilesPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveProfiles !== null) {
      applyLiveSlice(
        liveProfiles,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch(() => {
        /* live channel may still populate */
      })
      .finally(() => setLoading(false));
  }, [
    liveProfiles,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setName(profile.name);
    setFromName(profile.from_name);
    setFromEmail(profile.from_email);
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("Default SMTP");
    setFromName("HRNECK");
    setFromEmail("noreply@hrneck.com");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      const payload = {
        name,
        from_name: fromName,
        from_email: fromEmail,
        mailer: "smtp",
        is_default: true,
      };
      if (editingId !== null) {
        await api(`/api/v1/org/sending-profiles/${editingId}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/v1/org/sending-profiles", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setLiveProfiles(null);
      await refreshFromApi(page, perPage, filters);
      resetForm();
      setMessage("Profile saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed — sign in first");
    }
  }

  async function deleteProfile(profile: Profile) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/sending-profiles/${profile.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setLiveProfiles(null);
      await refreshFromApi(page, perPage, filters);
      setMessage("Profile deleted.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  const columns: Array<DataTableColumn<Profile>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (profile) => (
        <span>
          {profile.name}
          {profile.is_default ? " · default" : ""}
        </span>
      ),
    },
    {
      id: "from_name",
      header: "From name",
      accessorKey: "from_name",
      cell: (profile) => profile.from_name,
    },
    {
      id: "from_email",
      header: "From email",
      accessorKey: "from_email",
      cell: (profile) => profile.from_email,
    },
    {
      id: "mailer",
      header: "Mailer",
      accessorKey: "mailer",
      cell: (profile) => profile.mailer,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (profile) => (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => startEdit(profile)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => setPendingDelete(profile)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Sending profiles"
        description={statusLabel ?? "Live"}
        actions={
          <LinkButton href="/org/settings" variant="secondary">
            Settings
          </LinkButton>
        }
      />
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="sp-name" className="text-[var(--muted-foreground)]">
            Name
          </Label>
          <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-from-name" className="text-[var(--muted-foreground)]">
            From name
          </Label>
          <Input
            id="sp-from-name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-from-email" className="text-[var(--muted-foreground)]">
            From email
          </Label>
          <Input
            id="sp-from-email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editingId !== null ? "Update profile" : "Save profile"}</Button>
          {editingId !== null ? (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>
      {message ? (
        <Alert className="mt-4" variant={alertVariantForMessage(message)}>
          {message}
        </Alert>
      ) : null}
      {liveError ? (
        <Alert className="mt-4" variant="destructive">
          {liveError}
        </Alert>
      ) : null}
      <DataTable
        className="mt-10"
        mode="server"
        caption="Sending profiles"
        columns={columns}
        rows={profiles}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle={status === "live" ? "No sending profiles" : "Connecting…"}
        emptyDescription={
          status === "live"
            ? "Save a profile to choose From name and email for outbound mail."
            : (statusLabel ?? "Waiting for live data…")
        }
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

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete sending profile"
        description={`Delete sending profile “${pendingDelete?.name}”?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteProfile(pendingDelete);
        }}
      />
    </div>
  );
}
