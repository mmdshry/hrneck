"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { orgLiveChannel } from "@/lib/live-topics";
import { resolveTenant } from "@/lib/tenant";
import {
  ANSWERABLE,
  isVisible,
  type AuditEvent,
  type ChecklistInstance,
  type ChecklistItem,
} from "../../checklist-types";

const auditColumns: Array<DataTableColumn<AuditEvent>> = [
  {
    id: "event",
    header: "Event",
    accessorKey: "event",
    sticky: true,
    cell: (row) => row.event || "—",
  },
  {
    id: "description",
    header: "Description",
    accessorKey: "description",
    className: "max-w-md whitespace-pre-wrap",
    cell: (row) => row.description,
  },
  {
    id: "created_at",
    header: "When",
    accessorKey: "created_at",
    cell: (row) => row.created_at || "—",
  },
  {
    id: "causer_id",
    header: "Causer",
    accessorKey: "causer_id",
    filterValue: (row) => row.causer_id,
    cell: (row) => (row.causer_id == null ? "—" : `#${row.causer_id}`),
  },
  {
    id: "properties",
    header: "Properties",
    filterValue: (row) => JSON.stringify(row.properties ?? {}),
    enableGlobalFilter: false,
    enableSorting: false,
    className: "max-w-xs",
    cell: (row) => (
      <pre className="overflow-x-auto text-xs">{JSON.stringify(row.properties, null, 2)}</pre>
    ),
  },
];

export function ChecklistFillClient({ instanceId }: { instanceId: number }) {
  const tenant = resolveTenant();
  const [instance, setInstance] = useState<ChecklistInstance | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [tab, setTab] = useState<"form" | "audit">("form");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveEpoch, setLiveEpoch] = useState(0);

  const channel = useMemo(
    () => (tenant ? orgLiveChannel(tenant, "checklist-instances") : null),
    [tenant],
  );

  const onLivePayload = useCallback(() => {
    setLiveEpoch((n) => n + 1);
  }, []);

  const { status: liveStatus } = useLiveTopic({
    channel,
    onPayload: onLivePayload,
  });

  const load = useCallback(async () => {
    await ensureCsrf();
    const t = resolveTenant();
    const [inst, log] = await Promise.all([
      api<{ data: ChecklistInstance }>(`/api/v1/org/checklists/instances/${instanceId}`, {
        tenant: t,
      }),
      api<{ data: AuditEvent[] }>(`/api/v1/org/checklists/instances/${instanceId}/audit`, {
        tenant: t,
      }),
    ]);
    setInstance(inst.data);
    const map: Record<string, unknown> = {};
    const fileMap: Record<string, string> = {};
    for (const row of inst.data.answers ?? []) {
      map[row.item_key] = row.value;
      if (row.file_disk_path) fileMap[row.item_key] = row.file_disk_path;
    }
    setAnswers(map);
    setFiles(fileMap);
    setAudit(log.data ?? []);
  }, [instanceId]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [instanceId, liveEpoch, load]);

  const statusLabel = liveStatusLabel(liveStatus);

  const visibleItems = useMemo(() => {
    const items = instance?.schema_snapshot?.items ?? [];
    return [...items]
      .sort((a, b) => a.order - b.order)
      .filter((item) => isVisible(item, answers));
  }, [instance, answers]);

  async function saveAnswers(nextStatus?: string) {
    if (!instance) return;
    setSaving(true);
    setMessage(null);
    try {
      await ensureCsrf();
      const payloadAnswers = Object.entries(answers)
        .filter(([key]) => {
          const item = instance.schema_snapshot?.items.find((i) => i.key === key);
          return item && ANSWERABLE.has(item.type) && isVisible(item, answers);
        })
        .map(([item_key, value]) => ({
          item_key,
          value,
          file_disk_path: files[item_key] ?? null,
        }));

      const res = await api<{ data: ChecklistInstance }>(
        `/api/v1/org/checklists/instances/${instanceId}`,
        {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: payloadAnswers,
            ...(nextStatus ? { status: nextStatus } : {}),
          }),
        },
      );
      setInstance(res.data);
      setMessage(nextStatus ? `Saved and marked ${nextStatus}.` : "Answers saved.");
      const log = await api<{ data: AuditEvent[] }>(
        `/api/v1/org/checklists/instances/${instanceId}/audit`,
        { tenant: resolveTenant() },
      );
      setAudit(log.data ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(itemKey: string, file: File) {
    setMessage(null);
    try {
      await ensureCsrf();
      const body = new FormData();
      body.append("file", file);
      const res = await api<{
        data: { file_disk_path: string; file_mime: string; file_size: number };
      }>("/api/v1/org/checklists/media/upload", {
        method: "POST",
        tenant: resolveTenant(),
        body,
      });
      setFiles((prev) => ({ ...prev, [itemKey]: res.data.file_disk_path }));
      setAnswers((prev) => ({ ...prev, [itemKey]: file.name }));
      setMessage(`Uploaded ${file.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function renderField(item: ChecklistItem) {
    const value = answers[item.key];
    if (item.type === "section") {
      return (
        <h3 key={item.key} className="pt-2 text-base font-semibold">
          {item.label}
        </h3>
      );
    }
    if (item.type === "rich_note" || item.type === "link") {
      return (
        <Panel key={item.key} className="space-y-1 p-3">
          <p className="text-sm font-medium">{item.label}</p>
          {item.help ? (
            <p className="text-sm text-[var(--muted-foreground)]">{item.help}</p>
          ) : null}
          {item.type === "link" && item.media?.url ? (
            <a
              href={item.media.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--primary)] underline"
            >
              {item.media.label || item.media.url}
            </a>
          ) : null}
        </Panel>
      );
    }

    return (
      <div key={item.key} className="space-y-1.5">
        <Label>
          {item.label}
          {item.required ? " *" : ""}
        </Label>
        {item.help ? (
          <p className="text-xs text-[var(--muted-foreground)]">{item.help}</p>
        ) : null}
        {item.type === "checkbox" ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [item.key]: e.target.checked }))
              }
            />
            Done
          </label>
        ) : null}
        {item.type === "short_text" ? (
          <Input
            value={String(value ?? "")}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [item.key]: e.target.value }))}
          />
        ) : null}
        {item.type === "long_text" ? (
          <Textarea
            rows={3}
            value={String(value ?? "")}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [item.key]: e.target.value }))}
          />
        ) : null}
        {item.type === "date" ? (
          <Input
            type="date"
            value={String(value ?? "")}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [item.key]: e.target.value }))}
          />
        ) : null}
        {item.type === "number" ? (
          <Input
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) =>
              setAnswers((prev) => ({
                ...prev,
                [item.key]: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
        ) : null}
        {item.type === "single_select" ? (
          <Select
            value={String(value ?? "")}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [item.key]: e.target.value }))}
          >
            <option value="">Select…</option>
            {(item.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        ) : null}
        {item.type === "multi_select" ? (
          <div className="space-y-1 rounded-[var(--radius)] border border-[var(--border)] p-2">
            {(item.options ?? []).map((opt) => {
              const selected = Array.isArray(value) ? (value as string[]) : [];
              return (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => {
                      const next = selected.includes(opt.value)
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value];
                      setAnswers((prev) => ({ ...prev, [item.key]: next }));
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        ) : null}
        {item.type === "file" ? (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(item.key, file);
              }}
            />
            {files[item.key] ? (
              <p className="text-xs text-[var(--muted-foreground)]">Stored: {files[item.key]}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" variant="form" rows={6} />;
  }

  if (!instance) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Fill checklist" />
        {message ? <Alert>{message}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
      <PageHeader
        title={instance.title}
        description={`${instance.target?.email ?? `Target #${instance.target_id}`} · ${instance.status} · ${instance.progress_pct}%${statusLabel ? ` · ${statusLabel}` : " · Live"}`}
        actions={
          <LinkButton href="/org/checklists/instances" variant="secondary" size="sm">
            Back
          </LinkButton>
        }
      />

      {message ? <Alert>{message}</Alert> : null}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "form" ? "default" : "secondary"}
          onClick={() => setTab("form")}
        >
          Form
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "audit" ? "default" : "secondary"}
          onClick={() => setTab("audit")}
        >
          Audit
        </Button>
      </div>

      {tab === "form" ? (
        <Panel className="space-y-4 p-4">
          {visibleItems.map((item) => renderField(item))}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" disabled={saving} onClick={() => void saveAnswers()}>
              Save progress
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => void saveAnswers("completed")}
            >
              Mark completed
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => void saveAnswers("cancelled")}
            >
              Cancel checklist
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel className="space-y-3 p-4">
          <DataTable
            mode="client"
            caption="Checklist audit"
            columns={auditColumns}
            rows={audit}
            getRowId={(row) => row.id}
            emptyTitle="No audit events yet."
          />
        </Panel>
      )}
    </div>
  );
}
