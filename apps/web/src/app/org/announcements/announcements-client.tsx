"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";

type Announcement = {
  id: number;
  title: string;
  body: string;
  published_at?: string | null;
};

export function AnnouncementsClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);

  async function load() {
    const tenant = resolveTenant();
    const res = await api<{ data: Announcement[] }>("/api/v1/org/announcements", {
      tenant,
    });
    setRows(res.data);
  }

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        setSession(me);
        if (me) {
          await load();
        }
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function onPublish(event: FormEvent) {
    event.preventDefault();
    setPublishing(true);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      await api("/api/v1/org/announcements", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      setTitle("");
      setBody("");
      await load();
      toastSuccess("Announcement published.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  async function deleteAnnouncement(row: Announcement) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/announcements/${row.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      await load();
      toastSuccess("Announcement deleted.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  if (!loaded) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  if (session && !hasPermission(session, "org.announcements.manage")) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader
          title="Announcements"
          description="Share news and updates with everyone in your organization."
        />
        <Alert>You need org.announcements.manage to publish announcements.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Announcements"
        description="Share news and updates with everyone in your organization."
      />

      <form onSubmit={onPublish} className="mt-8 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="announcement-title">Title</Label>
          <Input
            id="announcement-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={190}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="announcement-body">Message</Label>
          <textarea
            id="announcement-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={5000}
            rows={5}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
        <Button type="submit" disabled={publishing}>
          {publishing ? "Publishing…" : "Publish announcement"}
        </Button>
      </form>

      <section className="mt-10" aria-label="Recent announcements">
        <h2 className="text-lg font-medium">Recent</h2>
        {rows.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No announcements yet"
            description="Published messages appear here and in everyone’s notification bell."
          />
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">
                    {row.body}
                  </p>
                  {row.published_at ? (
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      {new Date(row.published_at).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-0 px-2 py-1 text-xs"
                  onClick={() => setPendingDelete(row)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete announcement"
        description={`Delete announcement “${pendingDelete?.title}”?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteAnnouncement(pendingDelete);
        }}
      />
    </div>
  );
}
