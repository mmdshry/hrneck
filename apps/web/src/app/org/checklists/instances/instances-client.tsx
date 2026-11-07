"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AudiencePicker,
  type AudienceGroup,
  type AudienceTarget,
} from "@/app/org/training/audience-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
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
import type { ChecklistInstance, ChecklistTemplate } from "../checklist-types";

export function ChecklistInstancesClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [targets, setTargets] = useState<AudienceTarget[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const instanceQuery = paginationQuery(nextPage, nextPerPage, {
      status: statusFilter || undefined,
    });
    const [tpl, inst, targetRes, groupRes] = await Promise.all([
      api<{ data: ChecklistTemplate[] }>(
        `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
        {
          tenant,
        },
      ),
      api(`/api/v1/org/checklists/instances?${instanceQuery}`, {
        tenant,
      }),
      api<{ data: AudienceTarget[] }>("/api/v1/org/targets?per_page=500", {
        tenant,
      }),
      api<{ data: AudienceGroup[] }>("/api/v1/org/groups?per_page=500", { tenant }),
    ]);
    const parsed = parsePaginatedResponse<ChecklistInstance>(inst, nextPerPage);
    setTemplates(tpl.data ?? []);
    setInstances(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
    setTargets(
      (targetRes.data ?? []).map((t) => ({
        id: t.id,
        email: t.email,
        first_name: t.first_name,
      })),
    );
    const groupsParsed = parsePaginatedResponse<AudienceGroup>(groupRes, 500);
    setGroups(groupsParsed.data.length ? groupsParsed.data : (groupRes.data ?? []));
    if (!templateId && tpl.data?.[0]) {
      setTemplateId(tpl.data[0].id);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, perPage]);

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!templateId) return;
    setMessage(null);
    try {
      await ensureCsrf();
      await api("/api/v1/org/checklists/instances", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          target_ids: selectedTargetIds,
          group_ids: selectedGroupIds,
        }),
      });
      setSelectedTargetIds([]);
      setSelectedGroupIds([]);
      setMessage("Instances created.");
      setPage(1);
      await refresh(1, perPage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Assign failed");
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.checklists.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklist instances" description="Assign templates to targets." />
        <Alert>You need org.checklists.manage to manage checklist instances.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Checklist instances"
        description="Assign templates to targets and fill them as HR. Employees have no access."
        actions={
          <LinkButton href="/org/checklists" variant="secondary">
            Templates
          </LinkButton>
        }
      />

      {message ? <Alert>{message}</Alert> : null}

      <Panel className="space-y-4 p-4">
        <h2 className="text-sm font-semibold">Assign to employees</h2>
        <form onSubmit={onAssign} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="instance-template">Template</Label>
            <Select
              id="instance-template"
              value={templateId === "" ? "" : String(templateId)}
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <AudiencePicker
            targets={targets}
            groups={groups}
            selectedTargetIds={selectedTargetIds}
            selectedGroupIds={selectedGroupIds}
            onChangeTargets={setSelectedTargetIds}
            onChangeGroups={setSelectedGroupIds}
          />
          <Button type="submit">Create instances</Button>
        </form>
      </Panel>

      <div className="flex items-center gap-3">
        <Label htmlFor="instance-status-filter" className="text-[var(--muted-foreground)]">
          Filter status
        </Label>
        <Select
          id="instance-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="">All</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <div className="grid gap-3">
        {instances.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No instances yet.</p>
        ) : (
          instances.map((inst) => (
            <Panel key={inst.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{inst.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {inst.target?.email ?? `target #${inst.target_id}`} · {inst.status} ·{" "}
                  {inst.progress_pct}%
                </p>
              </div>
              <LinkButton href={`/org/checklists/instances/${inst.id}`} size="sm">
                Fill / review
              </LinkButton>
            </Panel>
          ))
        )}
      </div>
      <Pagination
        page={page}
        perPage={perPage}
        total={meta.total}
        onPageChange={setPage}
        onPerPageChange={(size) => {
          setPerPage(size);
          setPage(1);
        }}
      />
    </div>
  );
}
