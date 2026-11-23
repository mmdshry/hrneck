"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import type { SdKbArticle, SdTicket } from "../ticketing-types";

type SearchMeta = {
  tickets: PaginationMeta;
  kb: PaginationMeta;
};

function parseSearchMeta(meta: unknown, fallbackPerPage: number): SearchMeta {
  const root = (meta ?? {}) as {
    tickets?: Partial<PaginationMeta>;
    kb?: Partial<PaginationMeta>;
  };
  const base = emptyMeta(fallbackPerPage);
  return {
    tickets: { ...base, ...root.tickets },
    kb: { ...base, ...root.kb },
  };
}

function searchQuery(ticketsPage: number, kbPage: number, perPage: number, q: string): string {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("per_page", String(perPage));
  params.set("tickets_page", String(Math.max(1, ticketsPage)));
  params.set("kb_page", String(Math.max(1, kbPage)));
  return params.toString();
}

export function SearchClient() {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [q, setQ] = useState("");
  const [activeQ, setActiveQ] = useState("");
  const [tickets, setTickets] = useState<SdTicket[]>([]);
  const [kb, setKb] = useState<SdKbArticle[]>([]);
  const [ticketsMeta, setTicketsMeta] = useState<PaginationMeta>(emptyMeta());
  const [kbMeta, setKbMeta] = useState<PaginationMeta>(emptyMeta());
  const [ticketsPage, setTicketsPage] = useState(1);
  const [kbPage, setKbPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const runSearch = useCallback(
    async (
      query: string,
      nextTicketsPage: number,
      nextKbPage: number,
      nextPerPage: number,
    ) => {
      await ensureCsrf();
      const res = await api<{
        data: { tickets: SdTicket[]; kb: SdKbArticle[] };
        meta: SearchMeta;
      }>(
        `/api/v1/org/ticketing/search?${searchQuery(nextTicketsPage, nextKbPage, nextPerPage, query)}`,
        { tenant: resolveTenant() },
      );
      const parsed = parseSearchMeta(res.meta, nextPerPage);
      setTickets(res.data?.tickets ?? []);
      setKb(res.data?.kb ?? []);
      setTicketsMeta(parsed.tickets);
      setKbMeta(parsed.kb);
      setTicketsPage(parsed.tickets.current_page || nextTicketsPage);
      setKbPage(parsed.kb.current_page || nextKbPage);
    },
    [],
  );

  useEffect(() => {
    if (!activeQ) {
      return;
    }
    void runSearch(activeQ, ticketsPage, kbPage, perPage).catch((err: unknown) => {
      toastError(err instanceof Error ? err.message : t("searchFailed"));
    });
  }, [activeQ, ticketsPage, kbPage, perPage, runSearch, t]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      return;
    }
    setTicketsPage(1);
    setKbPage(1);
    setActiveQ(trimmed);
  }

  const dash = tCommon("emDash");

  const ticketColumns: Array<DataTableColumn<SdTicket>> = [
    {
      id: "number",
      header: tCommon("number"),
      accessorKey: "number",
      sticky: true,
      cell: (ticket) => (
        <a
          className="font-medium underline-offset-2 hover:underline"
          href={`/org/ticketing/tickets/${ticket.id}`}
        >
          {ticket.number}
        </a>
      ),
    },
    {
      id: "summary",
      header: tCommon("summary"),
      accessorKey: "summary",
      cell: (ticket) => ticket.summary,
    },
    {
      id: "desk",
      header: tCommon("desk"),
      filterValue: (ticket) => ticket.desk?.name ?? "",
      enableSorting: false,
      cell: (ticket) => ticket.desk?.name ?? dash,
    },
    {
      id: "stage",
      header: tCommon("stage"),
      filterValue: (ticket) => ticket.stage?.name ?? "",
      enableSorting: false,
      cell: (ticket) => ticket.stage?.name ?? dash,
    },
    {
      id: "priority",
      header: tCommon("priority"),
      filterValue: (ticket) => ticket.priority?.name ?? "",
      enableSorting: false,
      cell: (ticket) => ticket.priority?.name ?? dash,
    },
  ];

  const kbColumns: Array<DataTableColumn<SdKbArticle>> = [
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
      className: "max-w-md truncate",
      cell: (article) => article.description || dash,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("searchAll")}
        description={t("searchDescription")}
        actions={
          <LinkButton href="/org/ticketing" variant="outline">
            {t("queue")}
          </LinkButton>
        }
      />
      <form className="flex flex-wrap items-end gap-2" onSubmit={onSearch}>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="ticketing-search-keyword">{tCommon("keyword")}</Label>
          <Input
            id="ticketing-search-keyword"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tCommon("keywordPlaceholder")}
            required
          />
        </div>
        <Button type="submit">{tCommon("search")}</Button>
      </form>
      <Panel title={t("ticketsPanel", { count: ticketsMeta.total })}>
        <DataTable
          mode="client"
          caption={t("ticketSearchResults")}
          columns={ticketColumns}
          rows={tickets}
          getRowId={(row) => row.id}
          emptyTitle={activeQ ? t("noMatchingTickets") : t("searchToListTickets")}
          pagination={
            activeQ
              ? {
                  page: ticketsPage,
                  perPage,
                  total: ticketsMeta.total,
                  onPageChange: setTicketsPage,
                  onPerPageChange: (size) => {
                    setPerPage(size);
                    setTicketsPage(1);
                    setKbPage(1);
                  },
                }
              : undefined
          }
        />
      </Panel>
      <Panel title={t("kbPanel", { count: kbMeta.total })}>
        <DataTable
          mode="client"
          caption={t("kbSearchResults")}
          columns={kbColumns}
          rows={kb}
          getRowId={(row) => row.id}
          emptyTitle={activeQ ? t("noMatchingArticles") : t("searchToListArticles")}
          pagination={
            activeQ
              ? {
                  page: kbPage,
                  perPage,
                  total: kbMeta.total,
                  onPageChange: setKbPage,
                  onPerPageChange: (size) => {
                    setPerPage(size);
                    setTicketsPage(1);
                    setKbPage(1);
                  },
                }
              : undefined
          }
        />
      </Panel>
    </div>
  );
}
