"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
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

function searchQuery(page: number, perPage: number, q: string): string {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("per_page", String(perPage));
  params.set("tickets_page", String(Math.max(1, page)));
  params.set("kb_page", String(Math.max(1, page)));
  return params.toString();
}

export function SearchClient() {
  const [q, setQ] = useState("");
  const [activeQ, setActiveQ] = useState("");
  const [tickets, setTickets] = useState<SdTicket[]>([]);
  const [kb, setKb] = useState<SdKbArticle[]>([]);
  const [ticketsMeta, setTicketsMeta] = useState<PaginationMeta>(emptyMeta());
  const [kbMeta, setKbMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);

  async function runSearch(
    query: string,
    nextPage = page,
    nextPerPage = perPage,
  ) {
    await ensureCsrf();
    const res = await api<{
      data: { tickets: SdTicket[]; kb: SdKbArticle[] };
      meta: SearchMeta;
    }>(`/api/v1/org/ticketing/search?${searchQuery(nextPage, nextPerPage, query)}`, {
      tenant: resolveTenant(),
    });
    const parsed = parseSearchMeta(res.meta, nextPerPage);
    setTickets(res.data?.tickets ?? []);
    setKb(res.data?.kb ?? []);
    setTicketsMeta(parsed.tickets);
    setKbMeta(parsed.kb);
    setPage(parsed.tickets.current_page);
  }

  useEffect(() => {
    if (!activeQ) {
      return;
    }
    void runSearch(activeQ).catch((err: unknown) => {
      setMessage(err instanceof Error ? err.message : "Search failed");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQ, page, perPage]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const trimmed = q.trim();
    if (!trimmed) {
      return;
    }
    setPage(1);
    setActiveQ(trimmed);
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Search all"
        description="Keyword search across tickets and KB articles."
        actions={<LinkButton href="/org/ticketing" variant="outline">Queue</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      <form className="flex gap-2" onSubmit={onSearch}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keyword…" required />
        <Button type="submit">Search</Button>
      </form>
      <Panel title={`Tickets (${ticketsMeta.total})`}>
        <ul className="space-y-2 text-sm">
          {tickets.map((t) => (
            <li key={t.id}>
              <a className="underline-offset-2 hover:underline" href={`/org/ticketing/tickets/${t.id}`}>
                {t.number} · {t.summary}
              </a>
            </li>
          ))}
          {activeQ && tickets.length === 0 ? (
            <li className="text-[var(--muted-foreground)]">No matching tickets.</li>
          ) : null}
        </ul>
        {activeQ ? (
          <Pagination
            className="mt-3"
            page={page}
            perPage={perPage}
            total={ticketsMeta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        ) : null}
      </Panel>
      <Panel title={`Knowledge base (${kbMeta.total})`}>
        <ul className="space-y-2 text-sm">
          {kb.map((a) => (
            <li key={a.id}>
              {a.number} · {a.summary}
            </li>
          ))}
          {activeQ && kb.length === 0 ? (
            <li className="text-[var(--muted-foreground)]">No matching articles.</li>
          ) : null}
        </ul>
        {activeQ ? (
          <Pagination
            className="mt-3"
            page={page}
            perPage={perPage}
            total={kbMeta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        ) : null}
      </Panel>
    </div>
  );
}
