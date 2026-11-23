"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastError } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { portalLiveChannel } from "@/lib/live-topics";
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

type Article = { id: number; number?: string | null; summary: string; description?: string | null };

type PortalPayload = {
  tickets?: unknown[];
  desks?: unknown[];
  kb: Article[];
};

function articleCells(article: Article): Record<string, string> {
  return {
    number: article.number ?? "",
    summary: article.summary,
    description: article.description ?? "",
  };
}

function filterArticles(
  items: Article[],
  q: string,
  columnFilters: Record<string, string>,
): Article[] {
  const needle = q.trim().toLowerCase();
  return items.filter((article) => {
    const cells = articleCells(article);
    if (needle) {
      const hay = `${cells.number} ${cells.summary} ${cells.description}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    for (const [key, raw] of Object.entries(columnFilters)) {
      const value = raw.trim().toLowerCase();
      if (!value) continue;
      if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
    }
    return true;
  });
}

export function PortalKbClient() {
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const [userId, setUserId] = useState<number | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [liveArticles, setLiveArticles] = useState<Article[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const channel =
    tenant && userId != null ? portalLiveChannel(tenant, userId) : null;

  const applyLiveSlice = useCallback(
    (
      items: Article[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = filterArticles(items, q, columnFilters);
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setArticles(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: PortalPayload) => {
    setLiveArticles(Array.isArray(payload.kb) ? payload.kb : []);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      setAuthChecked(true);
      setSignedIn(Boolean(me));
      setUserId(me?.id ?? null);
      if (!me) {
        return;
      }
      const res = await api(
        `/api/v1/org/portal/ticketing/kb?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: resolveTenant() },
      );
      const parsed = parsePaginatedResponse<Article>(res, nextPerPage);
      setArticles(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<PortalPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser()
      .then((me) => {
        setAuthChecked(true);
        setSignedIn(Boolean(me));
        setUserId(me?.id ?? null);
      })
      .catch(() => {
        setAuthChecked(true);
        setSignedIn(false);
        setUserId(null);
      });
  }, []);

  useEffect(() => {
    if (!authChecked || !signedIn) return;
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
      return;
    }
    void refreshFromApi(page, perPage, filters).catch((err: unknown) =>
      toastError(err instanceof Error ? err.message : t("loadFailed")),
    );
  }, [
    authChecked,
    signedIn,
    liveArticles,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
    t,
  ]);

  const statusLabel = liveStatusLabel(status);
  const dash = tCommon("emDash");

  const articleColumns: Array<DataTableColumn<Article>> = [
    {
      id: "number",
      header: tCommon("number"),
      accessorKey: "number",
      sticky: true,
      cell: (article) => article.number || dash,
    },
    {
      id: "summary",
      header: t("summary"),
      accessorKey: "summary",
      cell: (article) => article.summary,
    },
    {
      id: "description",
      header: t("details"),
      accessorKey: "description",
      className: "max-w-md whitespace-pre-wrap",
      cell: (article) => article.description || dash,
    },
  ];

  if (!authChecked) {
    return <PageSkeleton />;
  }

  if (authChecked && !signedIn) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("knowledgeBase")} description={t("kbDescription")} />
        <EmptyState
          title={t("signInToBrowseKb")}
          action={
            <LinkButton href="/login?next=/portal/kb" variant="link" size="sm" className="px-1">
              {t("signIn")}
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("knowledgeBase")}
        description={
          statusLabel
            ? `${t("kbDescription")} · ${statusLabel}`
            : t("kbDescription")
        }
      />
      
      
      <Panel title={t("articles")}>
        <DataTable
          mode="server"
          caption={t("articlesCaption")}
          columns={articleColumns}
          rows={articles}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noArticles")}
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
    </div>
  );
}
