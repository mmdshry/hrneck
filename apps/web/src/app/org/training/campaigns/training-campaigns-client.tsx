"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
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

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Archived", value: "archived" },
];

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid)\b/.test(m) ||
    m.includes("load failed") ||
    m.includes("create failed")
  ) {
    return "destructive";
  }
  if (m.includes("launched") || m.includes("reminders queued")) {
    return "success";
  }
  if (m.includes("select") || m.includes("no targets")) return "default";
  return "default";
}

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
  const [message, setMessage] = useState<string | null>(null);
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
    const t = resolveTenant();
    const canCampaigns = me ? hasPermission(me, "org.campaigns.manage") : false;
    const canTargets = me ? hasPermission(me, "org.targets.manage") : false;
    const canGroups = me ? hasPermission(me, "org.groups.manage") : false;
    const [dashRes, coursesRes, targetsRes, groupsRes] = await Promise.all([
      canCampaigns
        ? apiOptional<{ data: Dash }>("/api/v1/org/campaigns/dashboard?type=training", {
            tenant: t,
          })
        : Promise.resolve(null),
      apiOptional(`/api/v1/org/training/courses?${paginationQuery(1, 100)}`, { tenant: t }),
      canTargets
        ? apiOptional(`/api/v1/org/targets?${paginationQuery(1, 500)}`, { tenant: t })
        : Promise.resolve(null),
      canGroups
        ? apiOptional(`/api/v1/org/groups?${paginationQuery(1, 500)}`, { tenant: t })
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
      const t = resolveTenant();
      const campaignsRes = await api(
        `/api/v1/org/campaigns?${paginationQuery(nextPage, nextPerPage, {
          type: "training",
          ...nextFilters,
        })}`,
        { tenant: t },
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
        setMessage(err instanceof Error ? err.message : "Load failed");
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
      setMessage(err instanceof Error ? err.message : "Load failed");
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

  async function createCampaign() {
    setMessage(null);
    try {
      if (selectedTargetIds.length === 0 && selectedGroupIds.length === 0) {
        setMessage("Select at least one target or group.");
        return;
      }
      await ensureCsrf();
      const t = resolveTenant();
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
        tenant: t,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setName("");
      setMessage("Training campaign launched; reminders queued.");
      await refreshAuxiliary();
      if (liveCampaigns === null) {
        await refreshCampaignsFromApi(page, perPage, filters);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

  const columns: Array<DataTableColumn<Campaign>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (campaign) => campaign.name,
    },
    {
      id: "status",
      header: "Status",
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      accessorKey: "status",
      cell: (campaign) => campaign.status,
    },
    {
      id: "course",
      header: "Course",
      filter: "none",
      filterValue: (campaign) => campaign.course?.title ?? "",
      enableSorting: false,
      cell: (campaign) => campaign.course?.title ?? "—",
    },
    {
      id: "recipients",
      header: "Assigned",
      filter: "none",
      enableSorting: false,
      cell: (campaign) => campaign.recipients?.length ?? 0,
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Training campaigns"
        description="Assign courses to selected users or groups, track enrollment funnel."
        actions={
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-sm text-[var(--muted-foreground)]">
              {statusLabel ?? "Live"}
            </span>
            <LinkButton href="/org/courses" variant="secondary">
              Course library
            </LinkButton>
            <LinkButton href="/learn" variant="secondary">
              Open /learn
            </LinkButton>
          </div>
        }
      />
      {dash ? (
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Campaigns", dash.campaigns_total],
            ["Enrollments", dash.enrollments_total ?? "—"],
            ["In progress", dash.enrollments_in_progress ?? "—"],
            ["Completed", dash.enrollments_completed ?? "—"],
            ["Opened %", dash.opened_pct],
            ["Completed %", dash.completed_pct],
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
          {statusLabel ?? "Waiting for live dashboard…"}
        </p>
      )}

      <Panel className="mt-8 space-y-4 p-5">
        <h2 className="text-lg font-medium">Launch campaign</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="training-campaign-name" className="text-[var(--muted-foreground)]">
              Name
            </Label>
            <Input
              id="training-campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 awareness"
            />
          </div>
          {courses.length > 0 ? (
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label htmlFor="training-course" className="text-[var(--muted-foreground)]">
                Course
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
          Create campaign
        </Button>
      </Panel>

      {courses.length === 0 && status === "live" ? (
        <EmptyState
          className="mt-4"
          title="No courses available"
          description="Add training content before launching a campaign."
        />
      ) : null}
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
      <DataTable
        className="mt-8"
        mode="server"
        caption="Training campaigns"
        columns={columns}
        rows={campaigns}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle="No training campaigns yet"
        emptyDescription="Create a campaign to assign a course to selected employees or groups."
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
