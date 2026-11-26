"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toastError, toastSuccess } from "@/lib/toast";
import type { SdKbArticle } from "../ticketing/ticketing-types";

const VIEW_PERMISSION = "org.kb.view";
const MANAGE_PERMISSION = "org.kb.manage";

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
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "kb") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [articles, setArticles] = useState<SdKbArticle[]>([]);
  const [liveArticles, setLiveArticles] = useState<SdKbArticle[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
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

  const canView = Boolean(session && hasPermission(session, VIEW_PERMISSION));
  const canManage = Boolean(session && hasPermission(session, MANAGE_PERMISSION));

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
      const tenantId = resolveTenant();
      const params = paginationQuery(nextPage, nextPerPage, nextFilters);
      const list = await api(`/api/v1/org/ticketing/kb?${params}`, { tenant: tenantId });
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
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    void fetchSessionUser()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (session && !hasPermission(session, VIEW_PERMISSION)) {
      toastError(t("needKbPermission"));
    }
  }, [session, t]);

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
        toastError(err instanceof Error ? err.message : tCommon("loadFailed")),
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
    tCommon,
  ]);

  const statusLabel = liveStatusLabel(status);
  const dash = tCommon("emDash");

  async function afterMutation() {
    if (liveArticles === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  function startEdit(article: SdKbArticle) {
    setEditingId(article.id);
    setSummary(article.summary);
    setDescription(article.description ?? "");
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
        toastSuccess(t("articleUpdated"));
      } else {
        await api("/api/v1/org/ticketing/kb", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary, description, is_published: true }),
        });
        toastSuccess(t("articlePublished"));
        setPage(1);
      }
      resetForm();
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("saveFailed"));
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
      toastSuccess(article.is_published ? t("articleUnpublished") : t("articlePublished"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("publishToggleFailed"));
    }
  }

  async function deleteArticle(article: SdKbArticle) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/kb/${article.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    if (editingId === article.id) resetForm();
    toastSuccess(t("articleDeleted"));
    await afterMutation();
  }

  const baseColumns: Array<DataTableColumn<SdKbArticle>> = [
    {
      id: "number",
      header: tCommon("number"),
      accessorKey: "number",
      sticky: true,
      cell: (article) => article.number || dash,
    },
    {
      id: "summary",
      header: tCommon("summary"),
      accessorKey: "summary",
      cell: (article) => article.summary,
    },
    {
      id: "description",
      header: tCommon("body"),
      accessorKey: "description",
      className: "max-w-md whitespace-pre-wrap",
      cell: (article) => article.description || dash,
    },
    {
      id: "published",
      header: tCommon("published"),
      filter: "select",
      filterOptions: [
        { label: tCommon("published"), value: "1" },
        { label: tCommon("draft"), value: "0" },
      ],
      filterValue: (article) => (article.is_published ? "1" : "0"),
      enableSorting: false,
      cell: (article) => (article.is_published ? tCommon("published") : tCommon("draft")),
    },
  ];

  const actionColumn: DataTableColumn<SdKbArticle> = {
    id: "actions",
    header: tCommon("actions"),
    filter: "none",
    enableSorting: false,
    enableGlobalFilter: false,
    cell: (article) => (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => startEdit(article)}
        >
          {tCommon("edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => void togglePublish(article)}
        >
          {article.is_published ? t("unpublish") : t("publish")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => setPendingDelete(article)}
        >
          {tCommon("delete")}
        </Button>
      </div>
    ),
  };

  const columns: Array<DataTableColumn<SdKbArticle>> = canManage
    ? [...baseColumns, actionColumn]
    : baseColumns;

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !canView) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("knowledgeBase")} description={t("kbDescription")} />
        <EmptyState title={t("needKbPermission")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("knowledgeBase")}
        description={
          statusLabel
            ? `${t("kbDescription")} · ${statusLabel}`
            : t("kbDescription")
        }
      />
      {canManage ? (
        <Panel title={editingId !== null ? t("editArticle") : t("newArticle")}>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label htmlFor="kb-summary">{tCommon("summary")}</Label>
              <Input
                id="kb-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kb-body">{tCommon("body")}</Label>
              <Textarea
                id="kb-body"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">
                {editingId !== null ? tCommon("saveChanges") : t("publish")}
              </Button>
              {editingId !== null ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  {tCommon("cancel")}
                </Button>
              ) : null}
            </div>
          </form>
        </Panel>
      ) : null}
      <Panel title={t("articles")}>
        <DataTable
          mode="server"
          caption={t("articlesCaption")}
          columns={columns}
          rows={articles}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noArticlesYet")}
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
        title={t("deleteArticle")}
        description={t("deleteArticleConfirm", {
          name: pendingDelete?.number ?? pendingDelete?.summary ?? "",
        })}
        confirmLabel={tCommon("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteArticle(pendingDelete);
        }}
      />
    </div>
  );
}
