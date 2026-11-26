"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastSuccess, toastError, toastInfo } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
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
import { hasAnyPermission, hasPermission } from "@/lib/session";
import { matchesCells } from "@/lib/table-filter";
import { resolveTenant } from "@/lib/tenant";
import { type AudienceGroup, type AudienceTarget } from "../audience-picker";
import { assignAudiencePayload, type AssignDraft } from "../training-assign-draft";
import { formatTs } from "../training-shared";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  isCourseListEditable,
  moveCourseId,
  parseDndId,
  reorderCourseId,
} from "./campaign-courses";
import {
  CampaignCourseList,
  CampaignCoursesCell,
  CampaignPanelDropzone,
  CourseDragPreview,
  LibraryCourseCard,
  type CourseDndLabels,
} from "./campaign-courses-dnd";
import { LaunchCampaignWizard } from "./launch-campaign-wizard";

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
  courses?: Course[];
  recipients?: unknown[];
  starts_at?: string | null;
  expires_at?: string | null;
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

/** Pointer position wins when it is over a target; otherwise fall back to the closest one. */
const preferPointerTargets: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCenter(args);
};

function courseIdsOf(campaign: Campaign): number[] {
  return (campaign.courses ?? []).map((course) => course.id);
}

function courseTitlesOf(campaign: Campaign): string[] {
  return (campaign.courses ?? []).map((course) => course.title);
}

export function TrainingCampaignsClient() {
  const t = useTranslations("org.campaigns");
  const tTraining = useTranslations("org.training");
  const tCommon = useTranslations("common");
  const orgTimeZone = useOrgTimezone();
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
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<Campaign | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManageCampaigns, setCanManageCampaigns] = useState(false);
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
          course: courseTitlesOf(campaign).join(" "),
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
    const canManage = me ? hasPermission(me, "org.campaigns.manage") : false;
    const canViewCampaigns = me
      ? hasAnyPermission(me, ["org.campaigns.view", "org.campaigns.manage"])
      : false;
    const canCourses = me
      ? hasAnyPermission(me, [
          "org.training.view",
          "org.training.manage",
          "org.campaigns.manage",
        ])
      : false;
    const canTargets = me
      ? hasAnyPermission(me, ["org.targets.view", "org.targets.manage"])
      : false;
    const canGroups = me
      ? hasAnyPermission(me, ["org.groups.view", "org.groups.manage"])
      : false;
    setCanManageCampaigns(canManage);
    const [dashRes, coursesRes, targetsRes, groupsRes] = await Promise.all([
      canViewCampaigns
        ? apiOptional<{ data: Dash }>("/api/v1/org/campaigns/dashboard?type=training", {
            tenant: tenantSlug,
          })
        : Promise.resolve(null),
      canCourses
        ? apiOptional(`/api/v1/org/training/courses?${paginationQuery(1, 100)}`, {
            tenant: tenantSlug,
          })
        : Promise.resolve(null),
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

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  async function refreshAfterMutation() {
    await refreshAuxiliary();
    if (liveCampaigns === null) {
      await refreshCampaignsFromApi(page, perPage, filters);
    }
  }

  async function launchCampaign(name: string, draft: AssignDraft): Promise<boolean> {
    let launched = false;
    try {
      await ensureCsrf();
      const tenantSlug = resolveTenant();
      const body: Record<string, unknown> = {
        name: name || t("defaultCampaignName", { date: new Date().toISOString() }),
        type: "training",
        course_ids: draft.courseIds,
        launch: true,
        ...assignAudiencePayload(draft),
      };

      const res = await api<{ data: { status?: string } }>("/api/v1/org/campaigns", {
        method: "POST",
        tenant: tenantSlug,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      launched = true;
      toastSuccess(
        res.data.status === "scheduled" ? tTraining("scheduledNotice") : t("launched"),
      );
      await refreshAfterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    }
    return launched;
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
      toastSuccess(t("campaignCancelled", { name: campaign.name }));
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
      toastSuccess(t("campaignArchived", { name: campaign.name }));
      await refreshAfterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("archiveFailed"));
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dndLabels: CourseDndLabels = {
    dragLibraryCourse: t("dragLibraryCourse"),
    dragMemberCourse: t("dragMemberCourse"),
    add: tCommon("add"),
    moveUp: t("moveCourseUp"),
    moveDown: t("moveCourseDown"),
    remove: tCommon("remove"),
    dropHere: t("dropCourseHere"),
    noCourses: t("noCampaignCourses"),
  };

  const allCampaigns = liveCampaigns ?? campaigns;
  const selectedCampaign =
    allCampaigns.find((row) => row.id === selectedCampaignId) ?? null;
  const selectedCampaignEditable = selectedCampaign
    ? isCourseListEditable(selectedCampaign.status)
    : false;

  function replaceCampaign(updated: Campaign) {
    const merge = (rows: Campaign[]) =>
      rows.map((row) => (row.id === updated.id ? { ...row, ...updated } : row));
    setCampaigns(merge);
    setLiveCampaigns((prev) => (prev ? merge(prev) : prev));
  }

  function findCampaign(campaignId: number | null): Campaign | undefined {
    if (campaignId === null) return undefined;
    return allCampaigns.find((row) => row.id === campaignId);
  }

  async function addCourseToCampaign(campaignId: number | null, courseId: number) {
    const campaign = findCampaign(campaignId);
    const course = courses.find((row) => row.id === courseId);
    if (!campaign || !course) return;
    if (!isCourseListEditable(campaign.status)) {
      toastInfo(t("courseLockedHint"));
      return;
    }
    if (courseIdsOf(campaign).includes(courseId)) {
      toastInfo(t("courseAlreadyInCampaign", { course: course.title }));
      return;
    }

    try {
      await ensureCsrf();
      const res = await api<{ data: Campaign }>(`/api/v1/org/campaigns/${campaign.id}/courses`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      replaceCampaign(res.data);
      toastSuccess(t("courseAdded", { course: course.title, campaign: campaign.name }));
      await refreshAfterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("courseUpdateFailed"));
    }
  }

  async function saveCourseOrder(campaign: Campaign, nextIds: number[]) {
    if (nextIds.join(",") === courseIdsOf(campaign).join(",")) return;

    const byId = new Map((campaign.courses ?? []).map((course) => [course.id, course] as const));
    const reordered = nextIds.flatMap((id) => {
      const course = byId.get(id);
      return course ? [course] : [];
    });
    replaceCampaign({ ...campaign, courses: reordered });

    try {
      await ensureCsrf();
      const res = await api<{ data: Campaign }>(
        `/api/v1/org/campaigns/${campaign.id}/courses/order`,
        {
          method: "PUT",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_ids: nextIds }),
        },
      );
      replaceCampaign(res.data);
      toastSuccess(t("courseOrderSaved"));
    } catch (err) {
      replaceCampaign(campaign);
      toastError(err instanceof Error ? err.message : t("courseUpdateFailed"));
      await refreshAfterMutation();
    }
  }

  function moveCourse(campaign: Campaign, courseId: number, delta: -1 | 1) {
    if (!isCourseListEditable(campaign.status)) {
      toastInfo(t("courseLockedHint"));
      return;
    }
    void saveCourseOrder(campaign, moveCourseId(courseIdsOf(campaign), courseId, delta));
  }

  async function removeCourseFromCampaign(campaign: Campaign, courseId: number) {
    if (!isCourseListEditable(campaign.status)) {
      toastInfo(t("courseLockedHint"));
      return;
    }
    const course = (campaign.courses ?? []).find((row) => row.id === courseId);

    try {
      await ensureCsrf();
      const res = await api<{ data: Campaign }>(
        `/api/v1/org/campaigns/${campaign.id}/courses/${courseId}`,
        { method: "DELETE", tenant: resolveTenant() },
      );
      replaceCampaign(res.data);
      toastSuccess(t("courseRemoved", { course: course?.title ?? "", campaign: campaign.name }));
      await refreshAfterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("courseUpdateFailed"));
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const source = parseDndId(String(event.active.id));
    if (!source) return;
    const pool = source.type === "library" ? courses : (selectedCampaign?.courses ?? []);
    setActiveDragLabel(pool.find((row) => row.id === source.id)?.title ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel(null);
    const source = parseDndId(String(event.active.id));
    const target = event.over ? parseDndId(String(event.over.id)) : null;
    if (!source || !target) return;

    if (source.type === "library") {
      if (target.type === "cell" || target.type === "panel") {
        void addCourseToCampaign(target.id, source.id);
      } else if (target.type === "member") {
        void addCourseToCampaign(selectedCampaignId, source.id);
      }
      return;
    }

    if (
      source.type === "member" &&
      target.type === "member" &&
      selectedCampaign &&
      selectedCampaignEditable
    ) {
      const nextIds = reorderCourseId(courseIdsOf(selectedCampaign), source.id, target.id);
      void saveCourseOrder(selectedCampaign, nextIds);
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
      filterValue: (campaign) => courseTitlesOf(campaign).join(" "),
      enableSorting: false,
      cell: (campaign) => (
        <CampaignCoursesCell
          campaignId={campaign.id}
          editable={isCourseListEditable(campaign.status)}
          courses={campaign.courses ?? []}
          labels={dndLabels}
        />
      ),
    },
    {
      id: "starts_at",
      header: tTraining("startsAt"),
      filter: "none",
      enableSorting: false,
      cell: (campaign) => formatTs(campaign.starts_at, orgTimeZone),
    },
    {
      id: "expires_at",
      header: tTraining("expiresAt"),
      filter: "none",
      enableSorting: false,
      cell: (campaign) => formatTs(campaign.expires_at, orgTimeZone),
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
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="compact"
              aria-pressed={selectedCampaignId === campaign.id}
              onClick={() => setSelectedCampaignId(campaign.id)}
            >
              {t("manageCourses")}
            </Button>
            {canCancel && canManageCampaigns ? (
              <Button
                type="button"
                variant="outline"
                size="compact"
                onClick={() => setPendingCancel(campaign)}
              >
                {tCommon("cancel")}
              </Button>
            ) : null}
            {canArchive && canManageCampaigns ? (
              <Button
                type="button"
                variant="outline"
                size="compact"
                onClick={() => setPendingArchive(campaign)}
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
    <DndContext
      sensors={sensors}
      collisionDetection={preferPointerTargets}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragLabel(null)}
    >
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
              <LinkButton href="/portal" variant="secondary">
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

        <Panel className="mt-8 flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="text-lg font-medium">{t("launchCampaign")}</h2>
          <Button
            type="button"
            onClick={() => setLaunchOpen(true)}
            disabled={courses.length === 0 || !canManageCampaigns}
          >
            {t("createCampaign")}
          </Button>
        </Panel>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Panel className="space-y-3 p-5">
            <h2 className="text-lg font-medium">{t("courseLibrary")}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{t("courseLibraryHint")}</p>
            {courses.length > 0 ? (
              <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {courses.map((course) => (
                  <LibraryCourseCard
                    key={course.id}
                    course={course}
                    canAdd={selectedCampaignEditable}
                    labels={dndLabels}
                    onAdd={(courseId) => void addCourseToCampaign(selectedCampaignId, courseId)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">{t("noCoursesAvailable")}</p>
            )}
          </Panel>

          <Panel className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="campaign-courses-select" className="text-[var(--muted-foreground)]">
                {t("campaignSelect")}
              </Label>
              <Select
                id="campaign-courses-select"
                value={selectedCampaignId === null ? "" : String(selectedCampaignId)}
                onChange={(e) =>
                  setSelectedCampaignId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">{t("chooseCampaign")}</option>
                {allCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </div>

            {selectedCampaign ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{selectedCampaign.name}</h3>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {selectedCampaign.status}
                  </span>
                </div>
                {selectedCampaignEditable ? null : (
                  <p className="text-sm text-[var(--muted-foreground)]">{t("courseLockedHint")}</p>
                )}
                <CampaignPanelDropzone
                  campaignId={selectedCampaign.id}
                  editable={selectedCampaignEditable}
                  className="min-h-24"
                >
                  {(selectedCampaign.courses ?? []).length > 0 ? (
                    <CampaignCourseList
                      courses={selectedCampaign.courses ?? []}
                      editable={selectedCampaignEditable}
                      labels={dndLabels}
                      onMove={(courseId, delta) => moveCourse(selectedCampaign, courseId, delta)}
                      onRemove={(courseId) => void removeCourseFromCampaign(selectedCampaign, courseId)}
                    />
                  ) : (
                    <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted-foreground)]">
                      {selectedCampaignEditable ? dndLabels.dropHere : dndLabels.noCourses}
                    </div>
                  )}
                </CampaignPanelDropzone>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">{t("noCampaignSelected")}</p>
            )}
          </Panel>
        </div>

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

        <LaunchCampaignWizard
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          courses={courses}
          targets={targets}
          groups={groups}
          onLaunch={launchCampaign}
        />

        <ConfirmDialog
          open={pendingCancel !== null}
          onOpenChange={(open) => {
            if (!open) setPendingCancel(null);
          }}
          title={t("cancelCampaignTitle")}
          description={t("cancelCampaignDescription", { name: pendingCancel?.name ?? "" })}
          confirmLabel={t("cancelCampaignAction")}
          cancelLabel={t("keepCampaign")}
          workingLabel={tCommon("working")}
          errorFallback={t("cancelFailed")}
          variant="destructive"
          onConfirm={async () => {
            if (pendingCancel) await cancelCampaign(pendingCancel);
          }}
        />

        <ConfirmDialog
          open={pendingArchive !== null}
          onOpenChange={(open) => {
            if (!open) setPendingArchive(null);
          }}
          title={t("archiveCampaignTitle")}
          description={t("archiveCampaignDescription", { name: pendingArchive?.name ?? "" })}
          confirmLabel={tCommon("archive")}
          cancelLabel={tCommon("cancel")}
          workingLabel={tCommon("working")}
          errorFallback={t("archiveFailed")}
          variant="destructive"
          onConfirm={async () => {
            if (pendingArchive) await archiveCampaign(pendingArchive);
          }}
        />
      </div>
      <DragOverlay>
        {activeDragLabel ? <CourseDragPreview label={activeDragLabel} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
