"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastSuccess, toastError, toastInfo } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, apiOptional, ensureCsrf, fetchSessionUser } from "@/lib/api";
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
import { hasPermission } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import {
  AudiencePicker,
  type AudienceGroup,
  type AudienceTarget,
} from "../audience-picker";

type Dash = {
  campaigns_total: number;
  completed: number;
  running: number;
  scheduled: number;
  no_action_pct: number;
  opened_pct: number;
  completed_pct: number;
  enrollments_total?: number;
  enrollments_completed?: number;
  enrollments_in_progress?: number;
};

type Campaign = {
  id: number;
  name: string;
  status: string;
  course?: { title: string } | null;
  recipients?: unknown[];
};

type Course = { id: number; title: string };

type TrainingCampaignsPayload = {
  dash: Dash;
  campaigns: Campaign[];
  courses: Course[];
  targets: AudienceTarget[];
  groups: AudienceGroup[];
};

const CANCELABLE_STATUSES = new Set(["draft", "scheduled", "running"]);
const ARCHIVE_VIA_DELETE = new Set(["running", "completed"]);
const ARCHIVE_VIA_PATCH = new Set(["draft", "scheduled", "cancelled"]);

function matchesCells(
  q: string,
  columnFilters: Record<string, string>,
  cells: Record<string, string>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle && !Object.values(cells).join(" ").toLowerCase().includes(needle)) {
    return false;
  }
  for (const [key, raw] of Object.entries(columnFilters)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
  }
  return true;
}

export function TrainingCampaignsClient() {
  const t = useTranslations("org.campaigns");
  const tCommon = useTranslations("common");
  const statusOptions = [
    { label: tCommon("draft"), value: "draft" },
    { label: tCommon("scheduled"), value: "scheduled" },
    { label: tCommon("running"), value: "running" },
    { label: tCommon("completed"), value: "completed" },
    { label: tCommon("cancelled"), value: "cancelled" },
    { label: tCommon("archived"), value: "archived" },
  ];
  const tenant = resolveTenant();
  const [dash, setDash] = useState<Dash | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [liveCampaigns, setLiveCampaigns] = useState<Campaign[] | null>(null);
  const [campaignsMeta, setCampaignsMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [courses, setCourses] = useState<Course[]>([]);
  const [targets, setTargets] = useState<AudienceTarget[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [courseId, setCourseId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const channel = useMemo(() => `org.${tenant}.training-campaigns`, [tenant]);

  const applyCampaignSlice = useCallback(
    (
      items: Campaign[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((campaign) =>
        matchesCells(q, columnFilters, {
          name: campaign.name,
          status: campaign.status,
          course: campaign.course?.title ?? "",
        }),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setCampaigns(sliced.data);
      setCampaignsMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const applyAuxiliary = useCallback(
    (
      nextDash: Dash | null,
      nextCourses: Course[],
      nextTargets: AudienceTarget[],
      nextGroups: AudienceGroup[],
    ) => {
      setDash(nextDash);
      setCourses(nextCourses);
      setTargets(nextTargets);
      setGroups(nextGroups);
      setCourseId((current) => {
        if (current !== "") return current;
        return nextCourses[0]?.id ?? "";
      });
    },
    [],
  );

  const applyPayload = useCallback(
    (payload: TrainingCampaignsPayload) => {
      applyAuxiliary(
        payload.dash ?? null,
        Array.isArray(payload.courses) ? payload.courses : [],
        Array.isArray(payload.targets) ? payload.targets : [],
        Array.isArray(payload.groups) ? payload.groups : [],
      );
      setLiveCampaigns(Array.isArray(payload.campaigns) ? payload.campaigns : []);
    },
    [applyAuxiliary],
  );

  const refreshAuxiliary = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    const tenantSlug = resolveTenant();
    const canCampaigns = me ? hasPermission(me, "org.campaigns.manage") : false;
    const canTargets = me ? hasPermission(me, "org.targets.manage") : false;
    const canGroups = me ? hasPermission(me, "org.groups.manage") : false;
    const [dashRes, coursesRes, targetsRes, groupsRes] = await Promise.all([
      canCampaigns
        ? apiOptional<{ data: Dash }>("/api/v1/org/campaigns/dashboard?type=training", {
            tenant: tenantSlug,
          })
        : Promise.resolve(null),
      apiOptional(`/api/v1/org/training/courses?${paginationQuery(1, 100)}`, {
        tenant: tenantSlug,
      }),
      canTargets
        ? apiOptional(`/api/v1/org/targets?${paginationQuery(1, 500)}`, {
            tenant: tenantSlug,
          })
        : Promise.resolve(null),
      canGroups
        ? apiOptional(`/api/v1/org/groups?${paginationQuery(1, 500)}`, {
            tenant: tenantSlug,
          })
        : Promise.resolve(null),
    ]);
    const coursesParsed = coursesRes
      ? parsePaginatedResponse<Course>(coursesRes, 100)
      : { data: [] as Course[] };
    const targetsParsed = targetsRes
      ? parsePaginatedResponse<AudienceTarget>(targetsRes, 500)
      : { data: [] as AudienceTarget[] };
    const groupsParsed = groupsRes
      ? parsePaginatedResponse<AudienceGroup>(groupsRes, 500)
      : { data: [] as AudienceGroup[] };
    applyAuxiliary(
      dashRes?.data ?? null,
      coursesParsed.data,
      targetsParsed.data,
      groupsParsed.data,
    );
  }, [applyAuxiliary]);

  const refreshCampaignsFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const tenantSlug = resolveTenant();
      const campaignsRes = await api(
        `/api/v1/org/campaigns?${paginationQuery(nextPage, nextPerPage, {
          type: "training",
          ...nextFilters,
        })}`,
        { tenant: tenantSlug },
      );
      const parsed = parsePaginatedResponse<Campaign>(campaignsRes, nextPerPage);
      setCampaigns(parsed.data);
      setCampaignsMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<TrainingCampaignsPayload>({
    channel,
    onPayload: applyPayload,
  });

  useEffect(() => {
    void refreshAuxiliary()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [refreshAuxiliary]);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveCampaigns !== null) {
      applyCampaignSlice(
        liveCampaigns,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      return;
    }
    void refreshCampaignsFromApi(page, perPage, filters).catch((err: unknown) => {
      toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
    });
  }, [
    liveCampaigns,
    page,
    perPage,
    filters,
    filtersKey,
    applyCampaignSlice,
    refreshCampaignsFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function refreshAfterMutation() {
    await refreshAuxiliary();
    if (liveCampaigns === null) {
      await refreshCampaignsFromApi(page, perPage, filters);
    }
  }

  async function createCampaign() {
    
    try {
      if (selectedTargetIds.length === 0 && selectedGroupIds.length === 0) {
        toastInfo(t("selectTargetOrGroup"));
        return;
      }
      await ensureCsrf();
      const tenantSlug = resolveTenant();
      const body: Record<string, unknown> = {
        name: name || `Training ${new Date().toISOString()}`,
        type: "training",
        course_id: courseId || undefined,
        launch: true,
      };
      if (selectedTargetIds.length > 0) body.target_ids = selectedTargetIds;
      if (selectedGroupIds.length > 0) body.group_ids = selectedGroupIds;

      await api("/api/v1/org/campaigns", {
        method: "POST",
        tenant: tenantSlug,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setName("");
      toastSuccess(t("launched"));
      await refreshAfterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    }
  }

  async function cancelCampaign(campaign: Campaign) {
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/campaigns/${campaign.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      setLiveCampaigns((prev) =>
        prev
          ? prev.map((row) =>
              row.id === campaign.id ? { ...row, status: "cancelled" } : row,
            )
          : prev,
      );
      toastSuccess(`Campaign “${campaign.name}” cancelled.`);
      await refreshAfterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("cancelFailed"));
    }
  }

  async function archiveCampaign(campaign: Campaign) {
    
    try {
      await ensureCsrf();
      const tenantSlug = resolveTenant();
      if (ARCHIVE_VIA_DELETE.has(campaign.status)) {
        await api(`/api/v1/org/campaigns/${campaign.id}`, {
          method: "DELETE",
          tenant: tenantSlug,
        });
      } else {
        await api(`/api/v1/org/campaigns/${campaign.id}`, {
          method: "PATCH",
          tenant: tenantSlug,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        });
      }
      setLiveCampaigns((prev) =>
        prev
          ? prev.map((row) =>
              row.id === campaign.id ? { ...row, status: "archived" } : row,
            )
          : prev,
      );
      toastSuccess(`Campaign “${campaign.name}” archived.`);
      await refreshAfterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("archiveFailed"));
    }
  }

  const columns: Array<DataTableColumn<Campaign>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (campaign) => campaign.name,
    },
    {
      id: "status",
      header: tCommon("status"),
      filter: "select",
      filterOptions: statusOptions,
      accessorKey: "status",
      cell: (campaign) => campaign.status,
    },
    {
      id: "course",
      header: tCommon("course"),
      filter: "none",
      filterValue: (campaign) => campaign.course?.title ?? "",
      enableSorting: false,
      cell: (campaign) => campaign.course?.title ?? "—",
    },
    {
      id: "recipients",
      header: tCommon("assigned"),
      filter: "none",
      enableSorting: false,
      cell: (campaign) => campaign.recipients?.length ?? 0,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (campaign) => {
        const canCancel = CANCELABLE_STATUSES.has(campaign.status);
        const canArchive =
          ARCHIVE_VIA_DELETE.has(campaign.status) ||
          ARCHIVE_VIA_PATCH.has(campaign.status);
        if (!canCancel && !canArchive) return tCommon("emDash");
        return (
          <div className="flex flex-wrap items-center gap-2">
            {canCancel ? (
              <Button
                type="button"
                variant="outline"
                size="compact"
                onClick={() => void cancelCampaign(campaign)}
              >
                {tCommon("cancel")}
              </Button>
            ) : null}
            {canArchive ? (
              <Button
                type="button"
                variant="outline"
                size="compact"
                onClick={() => void archiveCampaign(campaign)}
              >
                {tCommon("archive")}
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-sm text-[var(--muted-foreground)]">
              {statusLabel ?? tCommon("live")}
            </span>
            <LinkButton href="/org/courses" variant="secondary">
              {t("courseLibrary")}
            </LinkButton>
            <LinkButton href="/learn" variant="secondary">
              {t("openLearn")}
            </LinkButton>
          </div>
        }
      />
      {dash ? (
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            [t("campaignsCaption"), dash.campaigns_total],
            [t("enrollments"), dash.enrollments_total ?? tCommon("emDash")],
            [tCommon("inProgress"), dash.enrollments_in_progress ?? tCommon("emDash")],
            [tCommon("completed"), dash.enrollments_completed ?? tCommon("emDash")],
            [t("openedPct"), dash.opened_pct],
            [t("completedPct"), dash.completed_pct],
          ].map(([label, value]) => (
            <Panel key={String(label)} className="px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {label}
              </dt>
              <dd className="mt-1 text-2xl font-medium">{value}</dd>
            </Panel>
          ))}
        </dl>
      ) : (
        <p className="mt-8 text-sm text-[var(--muted-foreground)]">
          {statusLabel ?? t("waitingLive")}
        </p>
      )}

      <Panel className="mt-8 space-y-4 p-5">
        <h2 className="text-lg font-medium">{t("launchCampaign")}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="training-campaign-name" className="text-[var(--muted-foreground)]">
              {tCommon("name")}
            </Label>
            <Input
              id="training-campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>
          {courses.length > 0 ? (
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label htmlFor="training-course" className="text-[var(--muted-foreground)]">
                {tCommon("course")}
              </Label>
              <Select
                id="training-course"
                value={courseId === "" ? "" : String(courseId)}
                onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        <AudiencePicker
          targets={targets}
          groups={groups}
          selectedTargetIds={selectedTargetIds}
          selectedGroupIds={selectedGroupIds}
          onChangeTargets={setSelectedTargetIds}
          onChangeGroups={setSelectedGroupIds}
        />

        <Button type="button" onClick={() => void createCampaign()} disabled={courses.length === 0}>
          {t("createCampaign")}
        </Button>
      </Panel>

      {courses.length === 0 && status === "live" ? (
        <EmptyState
          className="mt-4"
          title={t("noCoursesAvailable")}
          description={t("noCoursesHint")}
        />
      ) : null}
      
      
      <DataTable
        className="mt-8"
        mode="server"
        caption={t("campaignsCaption")}
        columns={columns}
        rows={campaigns}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle={t("noCampaignsYet")}
        emptyDescription={t("noCampaignsHint")}
        pagination={{
          page,
          perPage,
          total: campaignsMeta.total,
          onPageChange: setPage,
          onPerPageChange: (size) => {
            setPerPage(size);
            setPage(1);
          },
        }}
      />
    </div>
  );
}
