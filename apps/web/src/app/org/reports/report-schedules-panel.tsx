"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";

type ReportSchedule = {
  id: number;
  name: string;
  cadence: "monthly" | "weekly" | "quarterly";
  format: "csv" | "pdf";
  recipient_email: string;
  next_run_at?: string | null;
};

export function ReportSchedulesPanel() {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [name, setName] = useState("Monthly CSV");
  const [cadence, setCadence] = useState<ReportSchedule["cadence"]>("monthly");
  const [format, setFormat] = useState<ReportSchedule["format"]>("csv");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReportSchedule | null>(null);
  const [editing, setEditing] = useState<ReportSchedule | null>(null);

  const refresh = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: ReportSchedule[] }>("/api/v1/org/reports/schedules", {
      tenant: resolveTenant(),
    });
    setSchedules(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load schedules");
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await ensureCsrf();
      await api("/api/v1/org/reports/schedules", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          cadence,
          format,
          recipient_email: recipientEmail,
        }),
      });
      setRecipientEmail("");
      await refresh();
      toastSuccess("Schedule created.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      setError(message);
      toastError(message);
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/reports/schedules/${editing.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          cadence: editing.cadence,
          format: editing.format,
          recipient_email: editing.recipient_email,
        }),
      });
      setEditing(null);
      await refresh();
      toastSuccess("Schedule updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      setError(message);
      toastError(message);
    }
  }

  async function onDelete() {
    if (!pendingDelete) return;
    try {
      await ensureCsrf();
      await api(`/api/v1/org/reports/schedules/${pendingDelete.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setPendingDelete(null);
      await refresh();
      toastSuccess("Schedule deleted.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onSendNow(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await ensureCsrf();
      await api("/api/v1/org/reports/email", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: oneOffEmail }),
      });
      toastSuccess("Report email queued.");
      setOneOffEmail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";
      setError(message);
      toastError(message);
    }
  }

  return (
    <Panel className="mt-8 space-y-6 p-4">
      <div>
        <h2 className="text-lg font-medium">Scheduled email reports</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Configure monthly, weekly, or quarterly cadences and send a one-off CSV report.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">{error}</Alert>
      ) : null}

      <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="schedule-name">Name</Label>
          <Input
            id="schedule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="schedule-cadence">Cadence</Label>
          <Select
            id="schedule-cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as ReportSchedule["cadence"])}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="schedule-format">Format</Label>
          <Select
            id="schedule-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportSchedule["format"])}
          >
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="schedule-email">Recipient email</Label>
          <Input
            id="schedule-email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Add schedule</Button>
        </div>
      </form>

      <form onSubmit={onSendNow} className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-4">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor="one-off-email">Send report now</Label>
          <Input
            id="one-off-email"
            type="email"
            value={oneOffEmail}
            onChange={(e) => setOneOffEmail(e.target.value)}
            placeholder="ops@example.com"
            required
          />
        </div>
        <Button type="submit" variant="secondary">
          Queue email
        </Button>
      </form>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-medium">Existing schedules</h3>
        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No schedules yet.</p>
        ) : (
          <ul className="space-y-3">
            {schedules.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
              >
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {row.cadence} · {row.format.toUpperCase()} · {row.recipient_email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(row)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingDelete(row)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={onSaveEdit}
          className="grid gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3 sm:grid-cols-2"
        >
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="edit-schedule-name">Edit name</Label>
            <Input
              id="edit-schedule-name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-schedule-cadence">Cadence</Label>
            <Select
              id="edit-schedule-cadence"
              value={editing.cadence}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  cadence: e.target.value as ReportSchedule["cadence"],
                })
              }
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-schedule-format">Format</Label>
            <Select
              id="edit-schedule-format"
              value={editing.format}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  format: e.target.value as ReportSchedule["format"],
                })
              }
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="edit-schedule-email">Recipient email</Label>
            <Input
              id="edit-schedule-email"
              type="email"
              value={editing.recipient_email}
              onChange={(e) => setEditing({ ...editing, recipient_email: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">Save changes</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete schedule?"
        description={
          pendingDelete
            ? `Remove “${pendingDelete.name}” (${pendingDelete.recipient_email})?`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onDelete}
      />
    </Panel>
  );
}
