"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type {
  ChecklistInstance,
  ChecklistPack,
  ChecklistTemplate,
} from "@/app/org/checklists/checklist-types";

type TargetDetail = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  department?: string | null;
  department_id?: number | null;
  status?: string | null;
  risk_score?: number | null;
  groups?: Array<{ id: number; name: string }>;
};

const STATUS_OPTIONS = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export function TargetDetailClient({ targetId }: { targetId: number }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [target, setTarget] = useState<TargetDetail | null>(null);
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [packs, setPacks] = useState<ChecklistPack[]>([]);
  const [assignMode, setAssignMode] = useState<"template" | "pack">("template");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [packId, setPackId] = useState<number | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManageChecklists = hasPermission(session, "org.checklists.manage");

  const refresh = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;

    const t = resolveTenant();
    const targetRes = await api<{ data: TargetDetail }>(`/api/v1/org/targets/${targetId}`, {
      tenant: t,
    });
    setTarget(targetRes.data);

    if (hasPermission(me, "org.checklists.manage")) {
      const [instRes, tplRes, packRes] = await Promise.all([
        api<{ data: ChecklistInstance[] }>(
          `/api/v1/org/checklists/instances?${paginationQuery(1, 100, {
            target_id: String(targetId),
          })}`,
          { tenant: t },
        ),
        api<{ data: ChecklistTemplate[] }>(
          `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
          { tenant: t },
        ),
        api<{ data: ChecklistPack[] }>(
          `/api/v1/org/checklists/packs?${paginationQuery(1, 100)}`,
          { tenant: t },
        ),
      ]);
      setInstances(instRes.data ?? []);
      const editable = (tplRes.data ?? []).filter((row) => !row.is_system);
      setTemplates(editable);
      const publishedPacks = (packRes.data ?? []).filter((row) => row.status !== "archived");
      setPacks(publishedPacks);
      setTemplateId((current) => current || editable[0]?.id || "");
      setPackId((current) => current || publishedPacks[0]?.id || "");
    } else {
      setInstances([]);
      setTemplates([]);
      setPacks([]);
    }
  }, [targetId]);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await ensureCsrf();
      const t = resolveTenant();
      if (assignMode === "pack") {
        if (!packId) return;
        await api(`/api/v1/org/checklists/packs/${packId}/assign`, {
          method: "POST",
          tenant: t,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_ids: [targetId] }),
        });
        setMessage("Welcome pack / checklist pack connected.");
      } else {
        if (!templateId) return;
        await api("/api/v1/org/checklists/instances", {
          method: "POST",
          tenant: t,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            target_ids: [targetId],
          }),
        });
        setMessage("Checklist connected to employee.");
      }
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<ChecklistInstance>> = [
    {
      id: "title",
      header: "Checklist",
      accessorKey: "title",
      sticky: true,
      cell: (row) => row.title,
    },
    {
      id: "status",
      header: "Status",
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      accessorKey: "status",
      cell: (row) => row.status,
    },
    {
      id: "progress",
      header: "Progress",
      filter: "none",
      enableSorting: false,
      cell: (row) => `${row.progress_pct}%`,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <LinkButton href={`/org/checklists/instances/${row.id}`} size="sm">
          Fill / review
        </LinkButton>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (!target) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Employee" description="Employee not found." />
        {message ? <Alert variant="destructive">{message}</Alert> : null}
        <LinkButton href="/org/targets" variant="secondary">
          Back to employees
        </LinkButton>
      </div>
    );
  }

  const displayName = [target.first_name, target.last_name].filter(Boolean).join(" ").trim();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={displayName || target.email}
        description={`${target.email}${target.department ? ` · ${target.department}` : ""}${
          target.status ? ` · ${target.status}` : ""
        }`}
        actions={
          <LinkButton href="/org/targets" variant="secondary">
            All employees
          </LinkButton>
        }
      />

      {message ? <Alert>{message}</Alert> : null}

      <Panel className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted-foreground)]">Email</dt>
            <dd>{target.email}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">Department</dt>
            <dd>{target.department || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">Status</dt>
            <dd>{target.status || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">Risk</dt>
            <dd>{target.risk_score ?? 0}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--muted-foreground)]">Groups</dt>
            <dd>
              {target.groups?.length
                ? target.groups.map((group) => group.name).join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
      </Panel>

      {canManageChecklists ? (
        <>
          <Panel className="space-y-4 p-4">
            <h2 className="text-sm font-semibold">Connect checklist</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              HR operators fill checklists. Employees have no portal access.
            </p>
            <form onSubmit={(e) => void onAssign(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="assign-mode">Assign</Label>
                <Select
                  id="assign-mode"
                  value={assignMode}
                  onChange={(e) => setAssignMode(e.target.value as "template" | "pack")}
                >
                  <option value="template">Single template</option>
                  <option value="pack">Checklist pack</option>
                </Select>
              </div>
              {assignMode === "pack" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="assign-pack">Pack</Label>
                  <Select
                    id="assign-pack"
                    value={packId === "" ? "" : String(packId)}
                    onChange={(e) => setPackId(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">Select pack</option>
                    {packs.map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        {pack.name}
                        {pack.auto_assign_on_create ? " (auto on hire)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="assign-template">Template</Label>
                  <Select
                    id="assign-template"
                    value={templateId === "" ? "" : String(templateId)}
                    onChange={(e) =>
                      setTemplateId(e.target.value ? Number(e.target.value) : "")
                    }
                    required
                  >
                    <option value="">Select template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? "Connecting…" : "Connect to employee"}
              </Button>
            </form>
          </Panel>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[var(--foreground)]">Connected checklists</h2>
            <DataTable
              mode="client"
              caption="Connected checklists"
              columns={columns}
              rows={instances}
              getRowId={(row) => row.id}
              emptyTitle="No checklists yet"
              emptyDescription="Connect a template or pack to this employee."
            />
          </section>
        </>
      ) : (
        <Alert>You need org.checklists.manage to view and connect checklists.</Alert>
      )}
    </div>
  );
}
