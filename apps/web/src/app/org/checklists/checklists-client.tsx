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
import type { ChecklistTemplate } from "./checklist-types";

export function ChecklistsClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [custom, setCustom] = useState<ChecklistTemplate[]>([]);
  const [customMeta, setCustomMeta] = useState<PaginationMeta>(emptyMeta());
  const [customPage, setCustomPage] = useState(1);
  const [customPerPage, setCustomPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [system, setSystem] = useState<ChecklistTemplate[]>([]);
  const [systemMeta, setSystemMeta] = useState<PaginationMeta>(emptyMeta());
  const [systemPage, setSystemPage] = useState(1);
  const [systemPerPage, setSystemPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh(
    nextCustomPage = customPage,
    nextCustomPerPage = customPerPage,
    nextSystemPage = systemPage,
    nextSystemPerPage = systemPerPage,
  ) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const customQuery = paginationQuery(nextCustomPage, nextCustomPerPage, {
      editable_only: 1,
    });
    const systemQuery = paginationQuery(nextSystemPage, nextSystemPerPage, {
      system_only: 1,
    });
    const [customList, systemList] = await Promise.all([
      api(`/api/v1/org/checklists/templates?${customQuery}`, { tenant }),
      api(`/api/v1/org/checklists/templates?${systemQuery}`, { tenant }),
    ]);
    const customParsed = parsePaginatedResponse<ChecklistTemplate>(customList, nextCustomPerPage);
    const systemParsed = parsePaginatedResponse<ChecklistTemplate>(systemList, nextSystemPerPage);
    setCustom(customParsed.data);
    setCustomMeta(customParsed.meta);
    setCustomPage(customParsed.meta.current_page);
    setSystem(systemParsed.data);
    setSystemMeta(systemParsed.meta);
    setSystemPage(systemParsed.meta.current_page);
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPage, customPerPage, systemPage, systemPerPage]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      const created = await api<{ data: ChecklistTemplate }>("/api/v1/org/checklists/templates", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          description: description || null,
          status: "draft",
          schema_json: { items: [] },
        }),
      });
      setName("");
      setDescription("");
      setMessage("Template created.");
      window.location.href = `/org/checklists/${created.data.id}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function copySystem(id: number) {
    setMessage(null);
    try {
      await ensureCsrf();
      const copied = await api<{ data: ChecklistTemplate }>(
        `/api/v1/org/checklists/templates/${id}/from-system`,
        {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      setMessage("Template copied. Opening builder…");
      window.location.href = `/org/checklists/${copied.data.id}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Copy failed");
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.checklists.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklists" description="Internal HR checklists." />
        <Alert>You need org.checklists.manage to manage checklists.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Checklists"
        description="Design flexible HR checklists and fill them for employees (targets). Employees never see these."
        actions={
          <LinkButton href="/org/checklists/instances" variant="secondary">
            Open instances
          </LinkButton>
        }
      />

      {message ? <Alert>{message}</Alert> : null}

      <Panel className="p-4">
        <h2 className="mb-3 text-sm font-semibold">New template</h2>
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cl-name">Name</Label>
            <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-cat">Category</Label>
            <Select id="cl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="onboarding">Onboarding</option>
              <option value="offboarding">Offboarding</option>
              <option value="hr_ops">HR ops</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cl-desc">Description</Label>
            <Textarea
              id="cl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Button type="submit">Create & design</Button>
          </div>
        </form>
      </Panel>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Your templates</h2>
        {custom.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No custom templates yet.</p>
        ) : (
          <div className="grid gap-3">
            {custom.map((t) => (
              <Panel key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t.category} · {t.status} · v{t.current_version}
                  </p>
                </div>
                <LinkButton href={`/org/checklists/${t.id}`} variant="secondary" size="sm">
                  Edit
                </LinkButton>
              </Panel>
            ))}
          </div>
        )}
        <Pagination
          page={customPage}
          perPage={customPerPage}
          total={customMeta.total}
          onPageChange={setCustomPage}
          onPerPageChange={(size) => {
            setCustomPerPage(size);
            setCustomPage(1);
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">HR system templates</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Read-only starters. Copy one to customize and assign to targets.
        </p>
        <div className="grid gap-3">
          {system.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No system templates.</p>
          ) : (
            system.map((t) => (
              <Panel key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="max-w-xl">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{t.category}</p>
                  {t.description ? (
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t.description}</p>
                  ) : null}
                </div>
                <Button type="button" size="sm" onClick={() => void copySystem(t.id)}>
                  Use template
                </Button>
              </Panel>
            ))
          )}
        </div>
        <Pagination
          page={systemPage}
          perPage={systemPerPage}
          total={systemMeta.total}
          onPageChange={setSystemPage}
          onPerPageChange={(size) => {
            setSystemPerPage(size);
            setSystemPage(1);
          }}
        />
      </section>
    </div>
  );
}
