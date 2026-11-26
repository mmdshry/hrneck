"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { ApiError, api, ensureCsrf } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { formatDateTime } from "@/lib/format-datetime";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginationQuery,
  parsePaginatedResponse,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";

type AuditPerson = {
  id: number;
  name: string | null;
  email: string | null;
};

type AuditSubject = {
  type: string;
  id: number | null;
  label: string | null;
  email: string | null;
};

type AuditEntry = {
  id: number;
  log_name: string | null;
  event: string | null;
  description: string;
  subject_type: string | null;
  subject_id: number | null;
  causer_id: number | null;
  causer: AuditPerson | null;
  subject: AuditSubject | null;
  properties: unknown;
  created_at: string | null;
};

function formatProperties(properties: unknown): string | null {
  if (properties == null) return null;
  const compact = JSON.stringify(properties);
  if (compact === "{}" || compact === "[]") return null;
  return JSON.stringify(properties, null, 2);
}

function EntityLines({
  primary,
  secondary,
  email,
}: {
  primary: string;
  secondary?: string | null;
  email?: string | null;
}) {
  return (
    <span className="block">
      <span className="block font-medium">{primary}</span>
      {secondary ? (
        <span className="block text-xs text-[var(--muted-foreground)]">{secondary}</span>
      ) : null}
      {email ? (
        <span className="block text-xs break-all text-[var(--muted-foreground)]">{email}</span>
      ) : null}
    </span>
  );
}

function ActorDetails({ causer, fallback }: { causer: AuditPerson; fallback: string }) {
  return <EntityLines primary={causer.name ?? fallback} email={causer.email} />;
}

function SubjectDetails({ subject }: { subject: AuditSubject | null }) {
  if (subject === null) return <span>—</span>;

  const typeLabel = subject.id !== null ? `${subject.type} #${subject.id}` : subject.type;

  if (subject.label === null) {
    return <EntityLines primary={typeLabel} email={subject.email} />;
  }

  return <EntityLines primary={subject.label} secondary={typeLabel} email={subject.email} />;
}

export function AuditLogClient() {
  const t = useTranslations("org.audit");
  const tCommon = useTranslations("common");
  const orgTimeZone = useOrgTimezone();
  const loadFailedMessage = tCommon("loadFailed");
  const [page, setPage] = useState(1);
  const tableQuery = useDataTableQuery({ onDebouncedChange: () => setPage(1) });
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const requestKey = JSON.stringify([page, perPage, filters]);
  const loading = settledKey !== requestKey;
  const initialLoaded = settledKey !== null;

  const load = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const res = await api(
        `/api/v1/org/audit?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: resolveTenant() },
      );
      const parsed = parsePaginatedResponse<AuditEntry>(res, nextPerPage);
      setEntries(parsed.data);
      setMeta(parsed.meta);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    load(page, perPage, filters)
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          return;
        }
        toastError(err instanceof Error ? err.message : loadFailedMessage);
      })
      .finally(() => {
        if (!cancelled) setSettledKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [load, page, perPage, filters, requestKey, loadFailedMessage]);

  const columns: Array<DataTableColumn<AuditEntry>> = [
    {
      id: "created_at",
      header: tCommon("whenLabel"),
      accessorKey: "created_at",
      sticky: true,
      filter: "none",
      cell: (entry) => (
        <span className="whitespace-nowrap">{formatDateTime(entry.created_at, orgTimeZone)}</span>
      ),
    },
    {
      id: "event",
      header: t("columns.event"),
      accessorKey: "event",
      cell: (entry) => (
        <span className="font-mono text-xs break-all">{entry.event ?? "—"}</span>
      ),
    },
    {
      id: "description",
      header: tCommon("descriptionLabel"),
      accessorKey: "description",
      filter: "none",
      enableSorting: false,
      cell: (entry) => (
        <span className="block max-w-md break-words whitespace-normal">{entry.description}</span>
      ),
    },
    {
      id: "subject",
      header: t("columns.subject"),
      filter: "none",
      enableSorting: false,
      cell: (entry) => <SubjectDetails subject={entry.subject} />,
    },
    {
      id: "actor",
      header: t("columns.actor"),
      filter: "none",
      enableSorting: false,
      cell: (entry) =>
        entry.causer !== null ? (
          <ActorDetails
            causer={entry.causer}
            fallback={t("actorUser", { id: String(entry.causer.id) })}
          />
        ) : (
          t("actorSystem")
        ),
    },
    {
      id: "details",
      header: tCommon("details"),
      filter: "none",
      enableSorting: false,
      cell: (entry) => {
        const json = formatProperties(entry.properties);
        if (json === null) return "—";
        return (
          <details className="max-w-xs">
            <summary className="cursor-pointer py-2 text-sm">{t("showDetails")}</summary>
            <pre className="mt-1 max-h-56 overflow-auto rounded-[var(--radius)] bg-[var(--muted)]/40 p-2 font-mono text-xs break-all whitespace-pre-wrap">
              {json}
            </pre>
          </details>
        );
      },
    },
  ];

  if (!initialLoaded) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")} />

      {forbidden ? (
        <EmptyState title={t("noAccessTitle")} description={t("noAccessDescription")} />
      ) : (
        <DataTable
          className="mt-8"
          mode="server"
          caption={t("caption")}
          columns={columns}
          rows={entries}
          loading={loading}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noEntries")}
          emptyFilteredTitle={t("noMatches")}
          emptyDescription={tableQuery.hasFilters ? undefined : t("noEntriesHint")}
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
      )}
    </div>
  );
}
