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
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";

type Article = { id: number; number?: string | null; summary: string; description?: string | null };

export function PortalKbClient() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  async function refresh(nextPage = page, nextPerPage = perPage, query = appliedQ) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setAuthChecked(true);
    setSignedIn(Boolean(me));
    if (!me) {
      return;
    }
    const params = paginationQuery(nextPage, nextPerPage, {
      q: query || undefined,
    });
    const res = await api(`/api/v1/org/portal/ticketing/kb?${params}`, {
      tenant: resolveTenant(),
    });
    const parsed = parsePaginatedResponse<Article>(res, nextPerPage);
    setArticles(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }

  useEffect(() => {
    void refresh().catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, appliedQ]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setAppliedQ(q.trim());
  }

  if (!authChecked) {
    return <PageSkeleton />;
  }

  if (authChecked && !signedIn) {
    return (
      <div className="space-y-4">
        <PageHeader title="Knowledge base" description="Self-service articles published by IT." />
        <Alert>
          Sign in to browse the knowledge base.{" "}
          <LinkButton href="/login?next=/portal/kb" variant="link" size="sm" className="px-1">
            Sign in
          </LinkButton>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge base" description="Self-service articles published by IT." />
      {message ? <Alert>{message}</Alert> : null}
      <form className="flex gap-2" onSubmit={onSearch}>
        <Label htmlFor="portal-kb-search" className="sr-only">
          Search articles
        </Label>
        <Input
          id="portal-kb-search"
          aria-label="Search articles"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search articles…"
        />
        <Button type="submit">Search</Button>
      </form>
      <Panel title="Articles">
        <ul className="space-y-3">
          {articles.map((a) => (
            <li key={a.id} className="rounded border border-[var(--border)] p-3">
              <div className="font-medium">
                {a.number} · {a.summary}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">{a.description}</div>
            </li>
          ))}
          {articles.length === 0 ? <li className="text-sm text-[var(--muted-foreground)]">No published articles.</li> : null}
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
