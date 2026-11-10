"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
  ITEM_TYPES,
  newItemKey,
  type ChecklistItem,
  type ChecklistItemType,
  type ChecklistTemplate,
} from "../checklist-types";

export function ChecklistBuilderClient({ templateId }: { templateId: number }) {
  const tenant = resolveTenant();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [category, setCategory] = useState("custom");
  const [description, setDescription] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveEpoch, setLiveEpoch] = useState(0);

  const channel = useMemo(
    () => (tenant ? orgLiveChannel(tenant, "checklists") : null),
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
    const res = await api<{ data: ChecklistTemplate }>(
      `/api/v1/org/checklists/templates/${templateId}`,
      { tenant: resolveTenant() },
    );
    setTemplate(res.data);
    setName(res.data.name);
    setStatus(res.data.status);
    setCategory(res.data.category);
    setDescription(res.data.description ?? "");
    const nextItems = [...(res.data.schema_json?.items ?? [])].sort(
      (a, b) => a.order - b.order,
    );
    setItems(nextItems);
    setSelectedKey(nextItems[0]?.key ?? null);
  }, [templateId]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [templateId, liveEpoch, load]);

  const statusLabel = liveStatusLabel(liveStatus);

  const selected = useMemo(
    () => items.find((i) => i.key === selectedKey) ?? null,
    [items, selectedKey],
  );

  function updateSelected(patch: Partial<ChecklistItem>) {
    if (!selectedKey) return;
    setItems((prev) =>
      prev.map((item) => (item.key === selectedKey ? { ...item, ...patch } : item)),
    );
  }

  function addItem(type: ChecklistItemType = "checkbox") {
    const key = newItemKey();
    const item: ChecklistItem = {
      key,
      type,
      label: type === "section" ? "New section" : "New item",
      required: false,
      order: items.length + 1,
      options:
        type === "single_select" || type === "multi_select"
          ? [
              { value: "option_a", label: "Option A" },
              { value: "option_b", label: "Option B" },
            ]
          : [],
      visible_when: null,
      requires: [],
    };
    setItems((prev) => [...prev, item]);
    setSelectedKey(key);
  }

  function removeSelected() {
    if (!selectedKey) return;
    setItems((prev) =>
      prev
        .filter((i) => i.key !== selectedKey)
        .map((i, idx) => ({ ...i, order: idx + 1 })),
    );
    setSelectedKey(null);
  }

  function moveSelected(dir: -1 | 1) {
    if (!selectedKey) return;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.key === selectedKey);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx]!;
      copy[idx] = copy[nextIdx]!;
      copy[nextIdx] = tmp;
      return copy.map((i, order) => ({ ...i, order: order + 1 }));
    });
  }

  async function persist(applyToOpen: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      await ensureCsrf();
      const normalized = items.map((item, index) => ({
        ...item,
        order: index + 1,
        options: item.options ?? [],
        requires: item.requires ?? [],
        visible_when: item.visible_when?.item_key ? item.visible_when : null,
      }));
      const res = await api<{ data: ChecklistTemplate }>(
        `/api/v1/org/checklists/templates/${templateId}`,
        {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            status,
            category,
            description: description || null,
            schema_json: { items: normalized },
            apply_to_open: applyToOpen,
          }),
        },
      );
      setTemplate(res.data);
      setItems([...(res.data.schema_json?.items ?? [])].sort((a, b) => a.order - b.order));
      setShowApplyDialog(false);
      setMessage(
        applyToOpen
          ? `Saved v${res.data.current_version} and applied to open instances.`
          : `Saved v${res.data.current_version}. Open instances keep their previous schema.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" variant="form" rows={8} />;
  }

  if (!template) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklist builder" />
        {message ? <Alert>{message}</Alert> : null}
      </div>
    );
  }

  if (template.is_system) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader
          title={template.name}
          description="System templates are read-only. Copy from the library to edit."
          actions={<LinkButton href="/org/checklists" variant="secondary">Back</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
      <PageHeader
        title="Checklist builder"
        description={`${template.slug} · version ${template.current_version}${statusLabel ? ` · ${statusLabel}` : " · Live"}`}
        actions={
          <>
            <LinkButton href="/org/checklists" variant="secondary" size="sm">
              Library
            </LinkButton>
            <LinkButton href="/org/checklists/instances" variant="secondary" size="sm">
              Instances
            </LinkButton>
            <Button type="button" size="sm" onClick={() => setShowApplyDialog(true)} disabled={saving}>
              Save
            </Button>
          </>
        }
      />

      {message ? <Alert>{message}</Alert> : null}

      <Panel className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="onboarding">Onboarding</option>
            <option value="offboarding">Offboarding</option>
            <option value="hr_ops">HR ops</option>
            <option value="custom">Custom</option>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Items</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => addItem()}>
              Add
            </Button>
          </div>
          <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(item.key)}
                  className={`w-full rounded-lg px-2 py-2 text-left text-sm ${
                    selectedKey === item.key
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "hover:bg-[var(--muted)]"
                  }`}
                >
                  <span className="block truncate font-medium">{item.label}</span>
                  <span className="block text-xs opacity-80">
                    {item.type}
                    {item.required ? " · required" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="space-y-3 p-4">
          {!selected ? (
            <p className="text-sm text-[var(--muted-foreground)]">Select an item to edit.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => moveSelected(-1)}>
                  Up
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => moveSelected(1)}>
                  Down
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={removeSelected}>
                  Delete
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Key</Label>
                  <Input
                    value={selected.key}
                    onChange={(e) => updateSelected({ key: e.target.value.replace(/\s+/g, "_") })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={selected.type}
                    onChange={(e) =>
                      updateSelected({ type: e.target.value as ChecklistItemType })
                    }
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Label</Label>
                  <Input
                    value={selected.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Help</Label>
                  <Input
                    value={selected.help ?? ""}
                    onChange={(e) => updateSelected({ help: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(selected.required)}
                    onChange={(e) => updateSelected({ required: e.target.checked })}
                  />
                  Required
                </label>
                {(selected.type === "single_select" || selected.type === "multi_select") && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Options (value:label per line)</Label>
                    <Textarea
                      rows={4}
                      value={(selected.options ?? [])
                        .map((o) => `${o.value}:${o.label}`)
                        .join("\n")}
                      onChange={(e) =>
                        updateSelected({
                          options: e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => {
                              const [value, ...rest] = line.split(":");
                              const label = rest.join(":") || value || "";
                              return { value: value || label, label };
                            }),
                        })
                      }
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Visible when item</Label>
                  <Select
                    value={selected.visible_when?.item_key ?? ""}
                    onChange={(e) =>
                      updateSelected({
                        visible_when: e.target.value
                          ? {
                              item_key: e.target.value,
                              op: selected.visible_when?.op ?? "eq",
                              value: selected.visible_when?.value ?? "yes",
                            }
                          : null,
                      })
                    }
                  >
                    <option value="">Always visible</option>
                    {items
                      .filter((i) => i.key !== selected.key)
                      .map((i) => (
                        <option key={i.key} value={i.key}>
                          {i.label}
                        </option>
                      ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Operator</Label>
                  <Select
                    value={selected.visible_when?.op ?? "eq"}
                    disabled={!selected.visible_when?.item_key}
                    onChange={(e) =>
                      updateSelected({
                        visible_when: selected.visible_when
                          ? {
                              ...selected.visible_when,
                              op: e.target.value as "eq" | "neq" | "in" | "not_empty",
                            }
                          : null,
                      })
                    }
                  >
                    <option value="eq">equals</option>
                    <option value="neq">not equals</option>
                    <option value="not_empty">not empty</option>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Compare value</Label>
                  <Input
                    disabled={!selected.visible_when?.item_key}
                    value={String(selected.visible_when?.value ?? "")}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const value =
                        raw === "true" ? true : raw === "false" ? false : raw;
                      updateSelected({
                        visible_when: selected.visible_when
                          ? { ...selected.visible_when, value }
                          : null,
                      });
                    }}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Requires (comma-separated keys)</Label>
                  <Input
                    value={(selected.requires ?? []).join(", ")}
                    onChange={(e) =>
                      updateSelected({
                        requires: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Dialog
        open={showApplyDialog}
        onOpenChange={setShowApplyDialog}
        title="Apply template changes?"
        description="Saving creates a new version. Choose whether open (not completed) employee instances should receive this schema now. Existing answers are kept by item key."
        dismissible={!saving}
      >
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={saving}
            onClick={() => void persist(false)}
            variant="secondary"
          >
            Only new instances
          </Button>
          <Button type="button" disabled={saving} onClick={() => void persist(true)}>
            Apply to open instances too
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => setShowApplyDialog(false)}
          >
            Cancel
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
