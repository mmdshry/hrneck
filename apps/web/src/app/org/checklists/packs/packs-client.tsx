"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { ChecklistPack, ChecklistTemplate } from "../checklist-types";

export function ChecklistPacksClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [packs, setPacks] = useState<ChecklistPack[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [autoAssign, setAutoAssign] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;
    const t = resolveTenant();
    const [packRes, tplRes] = await Promise.all([
      api<{ data: ChecklistPack[] }>(
        `/api/v1/org/checklists/packs?${paginationQuery(1, 100)}`,
        { tenant: t },
      ),
      api<{ data: ChecklistTemplate[] }>(
        `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
        { tenant: t },
      ),
    ]);
    setPacks(packRes.data ?? []);
    setTemplates((tplRes.data ?? []).filter((row) => !row.is_system));
  }, []);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  function toggleTemplate(id: number) {
    setSelectedTemplateIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function moveTemplate(id: number, direction: -1 | 1) {
    setSelectedTemplateIds((current) => {
      const index = current.indexOf(id);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (selectedTemplateIds.length === 0) {
      setMessage("Select at least one template.");
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      await ensureCsrf();
      const created = await api<{ data: ChecklistPack }>("/api/v1/org/checklists/packs", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status: "published",
          auto_assign_on_create: autoAssign,
          template_ids: selectedTemplateIds,
        }),
      });
      setName("");
      setDescription("");
      setSelectedTemplateIds([]);
      setAutoAssign(false);
      setMessage("Pack created.");
      window.location.href = `/org/checklists/packs/${created.data.id}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<ChecklistPack>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (pack) => pack.name,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (pack) => pack.status,
    },
    {
      id: "templates",
      header: "Templates",
      filter: "none",
      enableSorting: false,
      cell: (pack) => pack.template_ids?.length ?? pack.templates?.length ?? 0,
    },
    {
      id: "auto",
      header: "Auto on hire",
      filter: "none",
      enableSorting: false,
      cell: (pack) => (pack.auto_assign_on_create ? "Yes" : "No"),
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (pack) => (
        <LinkButton href={`/org/checklists/packs/${pack.id}`} size="sm">
          Edit
        </LinkButton>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.checklists.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklist packs" />
        <Alert>You need org.checklists.manage to manage packs.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Checklist packs"
        description="Bundle templates (e.g. Welcome Pack) and optionally auto-assign when an employee is created."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/checklists" variant="secondary">
              Templates
            </LinkButton>
            <LinkButton href="/org/checklists/instances" variant="secondary">
              Instances
            </LinkButton>
          </div>
        }
      />

      {message ? <Alert>{message}</Alert> : null}

      <Panel className="space-y-4 p-4">
        <h2 className="text-sm font-semibold">New pack</h2>
        <form onSubmit={(e) => void onCreate(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pack-name">Name</Label>
            <Input
              id="pack-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-desc">Description</Label>
            <Textarea
              id="pack-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Templates (order = assign order)</Label>
            <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
              {templates.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Copy a system template first, then add it to a pack.
                </p>
              ) : (
                templates.map((template) => {
                  const selected = selectedTemplateIds.includes(template.id);
                  const order = selectedTemplateIds.indexOf(template.id);
                  return (
                    <div
                      key={template.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleTemplate(template.id)}
                        />
                        <span>
                          {template.name}
                          {selected ? ` · #${order + 1}` : ""}
                        </span>
                      </label>
                      {selected ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => moveTemplate(template.id, -1)}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => moveTemplate(template.id, 1)}
                          >
                            Down
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
            />
            Auto-assign when a new employee is created
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create pack"}
          </Button>
        </form>
      </Panel>

      <DataTable
        mode="client"
        caption="Checklist packs"
        columns={columns}
        rows={packs}
        getRowId={(row) => row.id}
        emptyTitle="No packs yet"
        emptyDescription="Create a Welcome Pack from onboarding templates."
      />
    </div>
  );
}
