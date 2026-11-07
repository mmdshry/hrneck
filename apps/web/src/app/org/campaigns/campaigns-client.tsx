"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";

type Campaign = {
  id: number;
  name: string;
  status: string;
  recipients?: unknown[];
};

type Target = { id: number; email: string };

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid)\b/.test(m) ||
    m.includes("launch failed") ||
    m.includes("load failed")
  ) {
    return "destructive";
  }
  if (
    m.includes("queued") ||
    m.includes("campaign queued") ||
    m.includes("launched")
  ) {
    return "success";
  }
  if (m.includes("no targets")) return "default";
  return "default";
}

export function CampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    if (!me) {
      return;
    }
    const res = await api(
      `/api/v1/org/campaigns?${paginationQuery(nextPage, nextPerPage)}`,
      { tenant: resolveTenant() },
    );
    const parsed = parsePaginatedResponse<Campaign>(res, nextPerPage);
    setCampaigns(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  async function launch() {
    setMessage(null);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      const targets = await api<{ data: Target[] }>(
        "/api/v1/org/targets?per_page=500",
        { tenant },
      );
      const ids = (targets.data ?? []).map((t) => t.id);
      if (ids.length === 0) {
        setMessage("No targets — run directory sync first.");
        return;
      }
      await api("/api/v1/org/campaigns", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Training ${new Date().toISOString()}`,
          type: "training",
          target_ids: ids,
          launch: true,
        }),
      });
      setMessage("Campaign queued for send.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Launch failed");
    }
  }

  async function cancelCampaign(campaign: Campaign) {
    setMessage(null);
    try {
      await ensureCsrf();
      const status =
        campaign.status === "running" || campaign.status === "completed"
          ? "archived"
          : "cancelled";
      if (status === "archived") {
        await api(`/api/v1/org/campaigns/${campaign.id}`, {
          method: "DELETE",
          tenant: resolveTenant(),
        });
      } else {
        await api(`/api/v1/org/campaigns/${campaign.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      }
      setMessage(status === "archived" ? "Campaign archived." : "Campaign cancelled.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
      throw err;
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Campaigns"
        description="Prefer the training dashboard for focused workflows."
        actions={<Button type="button" onClick={() => void launch()}>Launch sample campaign</Button>}
      />
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <LinkButton href="/org/training/campaigns" variant="link" className="min-h-0 px-2 py-1">
          Training campaigns
        </LinkButton>
      </div>
      {message ? (
        <Alert className="mt-4" variant={alertVariantForMessage(message)}>
          {message}
        </Alert>
      ) : null}
      {campaigns.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No campaigns yet"
          description="Launch a sample campaign or use the training dashboard."
        />
      ) : (
        <ul className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium">{campaign.name}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{campaign.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm">
                  {campaign.recipients?.length ?? 0} recipients
                </p>
                {!["cancelled", "archived"].includes(campaign.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-0 px-2 py-1 text-xs"
                    onClick={() => setPendingCancel(campaign)}
                  >
                    {campaign.status === "running" || campaign.status === "completed"
                      ? "Archive"
                      : "Cancel"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
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

      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
        title={
          pendingCancel?.status === "running" || pendingCancel?.status === "completed"
            ? "Archive campaign"
            : "Cancel campaign"
        }
        description={`Cancel or archive “${pendingCancel?.name}”?`}
        confirmLabel={
          pendingCancel?.status === "running" || pendingCancel?.status === "completed"
            ? "Archive"
            : "Cancel campaign"
        }
        variant="destructive"
        onConfirm={async () => {
          if (!pendingCancel) return;
          await cancelCampaign(pendingCancel);
        }}
      />
    </div>
  );
}
