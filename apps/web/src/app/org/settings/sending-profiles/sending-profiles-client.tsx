"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";

type Profile = {
  id: number;
  name: string;
  from_name: string;
  from_email: string;
  mailer: string;
  is_default: boolean;
};

type ProfilesPayload = {
  data: Profile[];
};

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid)\b/.test(m) ||
    m.includes("load failed") ||
    m.includes("save failed")
  ) {
    return "destructive";
  }
  if (m.includes("saved")) return "success";
  return "default";
}

export function SendingProfilesClient() {
  const tenant = resolveTenant();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [liveProfiles, setLiveProfiles] = useState<Profile[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [name, setName] = useState("Default SMTP");
  const [fromName, setFromName] = useState("HRNECK");
  const [fromEmail, setFromEmail] = useState("noreply@hrneck.com");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);

  const channel = useMemo(() => `org.${tenant}.sending-profiles`, [tenant]);

  const applyLiveSlice = useCallback(
    (items: Profile[], nextPage: number, nextPerPage: number) => {
      const sliced = paginateLocal(items, nextPage, nextPerPage);
      setProfiles(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: ProfilesPayload) => {
    const items = Array.isArray(payload.data) ? payload.data : [];
    setLiveProfiles(items);
  }, []);

  const refreshFromApi = useCallback(async (nextPage: number, nextPerPage: number) => {
    await ensureCsrf();
    const res = await api(
      `/api/v1/org/sending-profiles?${paginationQuery(nextPage, nextPerPage)}`,
      {
        tenant: resolveTenant(),
      },
    );
    const parsed = parsePaginatedResponse<Profile>(res, nextPerPage);
    setProfiles(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }, []);

  const { status, error: liveError } = useLiveTopic<ProfilesPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveProfiles !== null) {
      applyLiveSlice(liveProfiles, page, perPage);
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage)
      .catch(() => {
        /* live channel may still populate */
      })
      .finally(() => setLoading(false));
  }, [liveProfiles, page, perPage, applyLiveSlice, refreshFromApi]);

  const statusLabel = liveStatusLabel(status);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      await api("/api/v1/org/sending-profiles", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          from_name: fromName,
          from_email: fromEmail,
          mailer: "smtp",
          is_default: true,
        }),
      });
      await refreshFromApi(page, perPage);
      setMessage("Profile saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed — sign in first");
    }
  }

  async function deleteProfile(profile: Profile) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/sending-profiles/${profile.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setLiveProfiles(null);
      await refreshFromApi(page, perPage);
      setMessage("Profile deleted.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  const listEmpty = profiles.length === 0 && meta.total === 0;

  if (loading) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Sending profiles"
        description={statusLabel ?? "Live"}
        actions={
          <LinkButton href="/org/settings" variant="secondary">
            Settings
          </LinkButton>
        }
      />
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="sp-name" className="text-[var(--muted-foreground)]">
            Name
          </Label>
          <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-from-name" className="text-[var(--muted-foreground)]">
            From name
          </Label>
          <Input
            id="sp-from-name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-from-email" className="text-[var(--muted-foreground)]">
            From email
          </Label>
          <Input
            id="sp-from-email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
        </div>
        <Button type="submit">Save profile</Button>
      </form>
      {message ? (
        <Alert className="mt-4" variant={alertVariantForMessage(message)}>
          {message}
        </Alert>
      ) : null}
      {liveError ? (
        <Alert className="mt-4" variant="destructive">
          {liveError}
        </Alert>
      ) : null}
      {listEmpty ? (
        <EmptyState
          className="mt-10"
          title={status === "live" ? "No sending profiles" : "Connecting…"}
          description={
            status === "live"
              ? "Save a profile to choose From name and email for outbound mail."
              : (statusLabel ?? "Waiting for live data…")
          }
        />
      ) : (
        <>
          <ul className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {p.name}
                    {p.is_default ? " · default" : ""}
                  </p>
                  <p className="text-[var(--muted-foreground)]">
                    {p.from_name} &lt;{p.from_email}&gt; · {p.mailer}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-0 px-2 py-1 text-xs"
                  onClick={() => setPendingDelete(p)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
          <Pagination
            className="mt-4"
            page={page}
            perPage={perPage}
            total={meta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete sending profile"
        description={`Delete sending profile “${pendingDelete?.name}”?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteProfile(pendingDelete);
        }}
      />
    </div>
  );
}
