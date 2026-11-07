"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
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

  const channel = useMemo(() => `org.${tenant}.training-campaigns`, [tenant]);

  const applyCampaignSlice = useCallback(
    (items: Campaign[], nextPage: number, nextPerPage: number) => {
      const sliced = paginateLocal(items, nextPage, nextPerPage);
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
    const t = resolveTenant();
    const [dashRes, coursesRes, targetsRes, groupsRes] = await Promise.all([
      api<{ data: Dash }>("/api/v1/org/campaigns/dashboard?type=training", { tenant: t }),
      api(`/api/v1/org/training/courses?${paginationQuery(1, 100)}`, { tenant: t }),
      api(`/api/v1/org/targets?${paginationQuery(1, 500)}`, { tenant: t }),
      api(`/api/v1/org/groups?${paginationQuery(1, 500)}`, { tenant: t }),
    ]);
    const coursesParsed = parsePaginatedResponse<Course>(coursesRes, 100);
    const targetsParsed = parsePaginatedResponse<AudienceTarget>(targetsRes, 500);
    const groupsParsed = parsePaginatedResponse<AudienceGroup>(groupsRes, 500);
    applyAuxiliary(
      dashRes.data ?? null,
      coursesParsed.data,
      targetsParsed.data,
      groupsParsed.data,
    );
  }, [applyAuxiliary]);

  const refreshCampaignsFromApi = useCallback(async (nextPage: number, nextPerPage: number) => {
    await ensureCsrf();
    const t = resolveTenant();
    const campaignsRes = await api(
      `/api/v1/org/campaigns?${paginationQuery(nextPage, nextPerPage, { type: "training" })}`,
      { tenant: t },
    );
    const parsed = parsePaginatedResponse<Campaign>(campaignsRes, nextPerPage);
    setCampaigns(parsed.data);
    setCampaignsMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }, []);

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
    if (liveCampaigns !== null) {
      applyCampaignSlice(liveCampaigns, page, perPage);
      return;
    }
    void refreshCampaignsFromApi(page, perPage).catch((err: unknown) => {
      setMessage(err instanceof Error ? err.message : "Load failed");
    });
  }, [liveCampaigns, page, perPage, applyCampaignSlice, refreshCampaignsFromApi]);

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
        await refreshCampaignsFromApi(page, perPage);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

  const campaignsListEmpty = campaigns.length === 0 && campaignsMeta.total === 0;

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
            <LinkButton href="/org/training" variant="secondary">
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
      {campaignsListEmpty && status === "live" ? (
        <EmptyState
          className="mt-8"
          title="No training campaigns yet"
          description="Create a campaign to assign a course to selected targets or groups."
        />
      ) : !campaignsListEmpty ? (
        <>
          <ul className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {c.status} · {c.course?.title ?? "course"}
                  </p>
                </div>
                <p className="text-sm">{c.recipients?.length ?? 0} assigned</p>
              </li>
            ))}
          </ul>
          <Pagination
            className="mt-4"
            page={page}
            perPage={perPage}
            total={campaignsMeta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
