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
import type { SdKbArticle } from "../ticketing-types";

export function KbClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [articles, setArticles] = useState<SdKbArticle[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh(nextPage = page, nextPerPage = perPage, nextQ = appliedQ) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const params = paginationQuery(nextPage, nextPerPage, {
      q: nextQ || undefined,
    });
    const list = await api(`/api/v1/org/ticketing/kb?${params}`, { tenant });
    const parsed = parsePaginatedResponse<SdKbArticle>(list, nextPerPage);
    setArticles(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) =>
        setMessage(err instanceof Error ? err.message : "Load failed"),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, appliedQ]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/kb", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, description, is_published: true }),
      });
      setSummary("");
      setDescription("");
      setMessage("Article published.");
      setPage(1);
      await refresh(1, perPage, appliedQ);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

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
        description="Known errors, workarounds, and resolutions."
        actions={<LinkButton href="/org/ticketing" variant="outline">Tickets</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      <Panel title="New article">
        <form className="space-y-3" onSubmit={onCreate}>
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
          <Button type="submit">Publish</Button>
        </form>
      </Panel>
      <Panel title="Articles">
        <div className="mb-3 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPage(1);
              setAppliedQ(q);
            }}
          >
            Search
          </Button>
        </div>
        <ul className="space-y-3">
          {articles.map((a) => (
            <li key={a.id} className="rounded border border-[var(--border)] p-3">
              <div className="font-medium">
                {a.number} · {a.summary}
              </div>
              <div className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{a.description}</div>
            </li>
          ))}
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
