"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastSuccess, toastError } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { matchesCells } from "@/lib/table-filter";
import { resolveTenant } from "@/lib/tenant";
import { SendingProfileDialog } from "./sending-profile-dialog";

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

function profileCells(profile: Profile): Record<string, string> {
  return {
    name: profile.name,
    from_name: profile.from_name,
    from_email: profile.from_email,
    mailer: profile.mailer,
  };
}

export function SendingProfilesClient() {
  const t = useTranslations("org.settings");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [liveProfiles, setLiveProfiles] = useState<Profile[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  /** Open editor. `profile` is null when creating. */
  const [editing, setEditing] = useState<{ profile: Profile | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const channel = useMemo(() => `org.${tenant}.sending-profiles`, [tenant]);

  const applyLiveSlice = useCallback(
    (
      items: Profile[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((profile) =>
        matchesCells(q, columnFilters, profileCells(profile)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
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

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const res = await api(
        `/api/v1/org/sending-profiles?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        {
          tenant: resolveTenant(),
        },
      );
      const parsed = parsePaginatedResponse<Profile>(res, nextPerPage);
      setProfiles(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status } = useLiveTopic<ProfilesPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveProfiles !== null) {
      applyLiveSlice(
        liveProfiles,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch(() => {
        /* live channel may still populate */
      })
      .finally(() => setLoading(false));
  }, [
    liveProfiles,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  async function reloadProfiles() {
    setLiveProfiles(null);
    await refreshFromApi(page, perPage, filters);
  }

  async function deleteProfile(profile: Profile) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/sending-profiles/${profile.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      await reloadProfiles();
      toastSuccess(t("profileDeleted"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
      throw err;
    }
  }

  const columns: Array<DataTableColumn<Profile>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (profile) => (
        <span>
          {profile.name}
          {profile.is_default ? ` · ${tCommon("default")}` : ""}
        </span>
      ),
    },
    {
      id: "from_name",
      header: t("fromName"),
      accessorKey: "from_name",
      cell: (profile) => profile.from_name,
    },
    {
      id: "from_email",
      header: t("fromEmail"),
      accessorKey: "from_email",
      cell: (profile) => profile.from_email,
    },
    {
      id: "mailer",
      header: tCommon("mailer"),
      accessorKey: "mailer",
      cell: (profile) => profile.mailer,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (profile) => (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setEditing({ profile })}
          >
            {tCommon("edit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setPendingDelete(profile)}
          >
            {tCommon("delete")}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("sendingProfilesTitle")}
        description={statusLabel ?? tCommon("live")}
        actions={
          <>
            <LinkButton href="/org/settings" variant="secondary">
              {t("title")}
            </LinkButton>
            <Button type="button" onClick={() => setEditing({ profile: null })}>
              {t("newProfile")}
            </Button>
          </>
        }
      />
      <DataTable
        className="mt-8"
        mode="server"
        caption={t("sendingProfilesTitle")}
        columns={columns}
        rows={profiles}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle={status === "live" ? t("noSendingProfiles") : tCommon("connecting")}
        emptyDescription={
          status === "live"
            ? t("profileEmptyHint")
            : (statusLabel ?? t("waitingLive"))
        }
        pagination={{
          page,
          perPage,
          total: meta.total,
          onPageChange: setPage,
          onPerPageChange: (size) => {
            setPerPage(size);
            setPage(1);
          },
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("deleteSendingProfile")}
        description={t("deleteProfileConfirm", { name: pendingDelete?.name ?? "" })}
        confirmLabel={tCommon("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteProfile(pendingDelete);
        }}
      />
      {editing ? (
        <SendingProfileDialog
          profile={editing.profile}
          onClose={() => setEditing(null)}
          onSaved={reloadProfiles}
        />
      ) : null}
    </div>
  );
}
