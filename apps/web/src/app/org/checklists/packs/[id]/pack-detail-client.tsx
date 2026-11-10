"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { ChecklistPack, ChecklistTemplate } from "../../checklist-types";

export function ChecklistPackDetailClient({ packId }: { packId: number }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [pack, setPack] = useState<ChecklistPack | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [autoAssign, setAutoAssign] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
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
      api<{ data: ChecklistPack }>(`/api/v1/org/checklists/packs/${packId}`, { tenant: t }),
      api<{ data: ChecklistTemplate[] }>(
        `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
        { tenant: t },
      ),
    ]);
    const next = packRes.data;
    setPack(next);
    setName(next.name);
    setDescription(next.description ?? "");
    setStatus(next.status);
    setAutoAssign(Boolean(next.auto_assign_on_create));
    setSelectedTemplateIds(next.template_ids ?? []);
    setTemplates((tplRes.data ?? []).filter((row) => !row.is_system));
  }, [packId]);

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

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (selectedTemplateIds.length === 0) {
      setMessage("Select at least one template.");
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      await ensureCsrf();
      const res = await api<{ data: ChecklistPack }>(`/api/v1/org/checklists/packs/${packId}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status,
          auto_assign_on_create: autoAssign,
          template_ids: selectedTemplateIds,
        }),
      });
      setPack(res.data);
      setMessage("Pack saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.checklists.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklist pack" />
        <Alert>You need org.checklists.manage to edit packs.</Alert>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklist pack" description="Pack not found." />
        {message ? <Alert variant="destructive">{message}</Alert> : null}
        <LinkButton href="/org/checklists/packs" variant="secondary">
          Back to packs
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={pack.name}
        description="Edit pack membership and auto-assign on hire."
        actions={
          <LinkButton href="/org/checklists/packs" variant="secondary">
            All packs
          </LinkButton>
        }
      />

      {message ? <Alert>{message}</Alert> : null}

      <Panel className="p-4">
        <form onSubmit={(e) => void onSave(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pack-edit-name">Name</Label>
            <Input
              id="pack-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-edit-desc">Description</Label>
            <Textarea
              id="pack-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-edit-status">Status</Label>
            <Select
              id="pack-edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Templates</Label>
            <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
              {templates.map((template) => {
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
              })}
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
            {saving ? "Saving…" : "Save pack"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
