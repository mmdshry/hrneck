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
import { Textarea } from "@/components/ui/textarea";
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
import type { SdKbArticle } from "../ticketing-types";

type KbPayload = {
  data: SdKbArticle[];
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

function articleCells(article: SdKbArticle): Record<string, string> {
  return {
    number: article.number ?? "",
    summary: article.summary,
    description: article.description ?? "",
    published: article.is_published ? "1" : "0",
  };
}

export function KbClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "kb") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [articles, setArticles] = useState<SdKbArticle[]>([]);
  const [liveArticles, setLiveArticles] = useState<SdKbArticle[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SdKbArticle | null>(null);
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
      items: SdKbArticle[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((article) =>
        matchesCells(q, columnFilters, articleCells(article)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setArticles(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: KbPayload) => {
    setLiveArticles(Array.isArray(payload.data) ? payload.data : []);
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
      const params = paginationQuery(nextPage, nextPerPage, nextFilters);
      const list = await api(`/api/v1/org/ticketing/kb?${params}`, { tenant: t });
      const parsed = parsePaginatedResponse<SdKbArticle>(list, nextPerPage);
      setArticles(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<KbPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveArticles !== null) {
      applyLiveSlice(
        liveArticles,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch((err: unknown) =>
        setMessage(err instanceof Error ? err.message : "Load failed"),
      )
      .finally(() => setLoading(false));
  }, [
    liveArticles,
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
    if (liveArticles === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  function startEdit(article: SdKbArticle) {
    setEditingId(article.id);
    setSummary(article.summary);
    setDescription(article.description ?? "");
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setSummary("");
    setDescription("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      if (editingId !== null) {
        await api(`/api/v1/org/ticketing/kb/${editingId}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary, description }),
        });
        setMessage("Article updated.");
      } else {
        await api("/api/v1/org/ticketing/kb", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary, description, is_published: true }),
        });
        setMessage("Article published.");
        setPage(1);
      }
      resetForm();
      await afterMutation();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function togglePublish(article: SdKbArticle) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/ticketing/kb/${article.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !article.is_published }),
      });
      setMessage(article.is_published ? "Article unpublished." : "Article published.");
      await afterMutation();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Publish toggle failed");
    }
  }

  async function deleteArticle(article: SdKbArticle) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/kb/${article.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    if (editingId === article.id) resetForm();
    setMessage("Article deleted.");
    await afterMutation();
  }

  const columns: Array<DataTableColumn<SdKbArticle>> = [
    {
      id: "number",
      header: "Number",
      accessorKey: "number",
      sticky: true,
      cell: (article) => article.number || "—",
    },
    {
      id: "summary",
      header: "Summary",
      accessorKey: "summary",
      cell: (article) => article.summary,
    },
    {
      id: "description",
      header: "Body",
      accessorKey: "description",
      className: "max-w-md whitespace-pre-wrap",
      cell: (article) => article.description || "—",
    },
    {
      id: "published",
      header: "Published",
      filter: "select",
      filterOptions: [
        { label: "Published", value: "1" },
        { label: "Draft", value: "0" },
      ],
      filterValue: (article) => (article.is_published ? "1" : "0"),
      enableSorting: false,
      cell: (article) => (article.is_published ? "Published" : "Draft"),
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (article) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => startEdit(article)}>
            Edit
          </Button>
          <Button type="button" variant="outline" onClick={() => void togglePublish(article)}>
            {article.is_published ? "Unpublish" : "Publish"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setPendingDelete(article)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.kb")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Knowledge Base" description="Articles." />
        <Alert>You need org.ticketing.kb.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Knowledge Base"
        description={
          statusLabel
            ? `Known errors, workarounds, and resolutions. · ${statusLabel}`
            : "Known errors, workarounds, and resolutions."
        }
        actions={<LinkButton href="/org/ticketing" variant="outline">Tickets</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      {liveError ? <Alert variant="destructive">{liveError}</Alert> : null}
      <Panel title={editingId !== null ? "Edit article" : "New article"}>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="kb-summary">Summary</Label>
            <Input
              id="kb-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kb-body">Body</Label>
            <Textarea
              id="kb-body"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{editingId !== null ? "Save changes" : "Publish"}</Button>
            {editingId !== null ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>
      <Panel title="Articles">
        <DataTable
          mode="server"
          caption="Knowledge base articles"
          columns={columns}
          rows={articles}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle="No articles yet."
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
        title="Delete article"
        description={`Delete KB article ${pendingDelete?.number ?? pendingDelete?.summary ?? ""}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteArticle(pendingDelete);
        }}
      />
    </div>
  );
}
