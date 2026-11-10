"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
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
  captureElementPng,
  downloadAuthenticated,
} from "@/lib/download";
import { orgLiveChannel } from "@/lib/live-topics";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastSuccess } from "@/lib/toast";
import {
  AudiencePicker,
  type AudienceGroup,
  type AudienceTarget,
} from "./audience-picker";
import {
  formatTs,
  type Course,
  type EnrollmentRow,
} from "./training-shared";

type TrainingPayload = {
  courses: Course[];
  enrollments: EnrollmentRow[];
  targets: AudienceTarget[];
  groups: AudienceGroup[];
};

function filterEnrollments(
  items: EnrollmentRow[],
  courseId: number | "",
  q: string,
  columnFilters: Record<string, string>,
): EnrollmentRow[] {
  const needle = q.trim().toLowerCase();
  const status = (columnFilters.status ?? "").trim();
  return items.filter((row) => {
    if (courseId !== "" && row.course?.id !== courseId) return false;
    if (status && row.status !== status) return false;
    if (needle) {
      const hay =
        `${row.target?.email ?? ""} ${row.target?.first_name ?? ""} ${row.course?.title ?? ""} ${row.status}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    for (const [key, raw] of Object.entries(columnFilters)) {
      if (key === "status") continue;
      const value = raw.trim().toLowerCase();
      if (!value) continue;
      const cell =
        key === "learner"
          ? `${row.target?.first_name ?? ""} ${row.target?.email ?? ""}`
          : key === "course"
            ? row.course?.title
            : key === "progress"
              ? String(row.progress)
              : "";
      if (!String(cell ?? "")
        .toLowerCase()
        .includes(value)) {
        return false;
      }
    }
    return true;
  });
}

export function TrainingHubClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "training") : null;
  const [pickerCourses, setPickerCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [liveEnrollments, setLiveEnrollments] = useState<EnrollmentRow[] | null>(null);
  const [enrollmentsMeta, setEnrollmentsMeta] = useState<PaginationMeta>(emptyMeta());
  const [enrollmentsPage, setEnrollmentsPage] = useState(1);
  const [enrollmentsPerPage, setEnrollmentsPerPage] =
    useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [targets, setTargets] = useState<AudienceTarget[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [filterCourseId, setFilterCourseId] = useState<number | "">("");
  const [filterGroupId, setFilterGroupId] = useState<number | "">("");
  const tableQuery = useDataTableQuery();
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | "png" | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionUser | null>(null);
  const viewingReportRef = useRef<HTMLDivElement>(null);
  const canManageCampaigns = hasPermission(session, "org.campaigns.manage");

  const enrollmentFilters = useMemo(
    () => ({
      course_id: filterCourseId === "" ? undefined : filterCourseId,
      group_id: filterGroupId === "" ? undefined : filterGroupId,
      ...serializeDataTableQuery(tableQuery.debounced),
    }),
    [filterCourseId, filterGroupId, tableQuery.debounced],
  );

  const applyEnrollmentSlice = useCallback(
    (
      items: EnrollmentRow[],
      nextPage: number,
      nextPerPage: number,
      courseId: number | "",
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = filterEnrollments(items, courseId, q, columnFilters);
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setEnrollments(sliced.data);
      setEnrollmentsMeta(sliced.meta);
      setEnrollmentsPage(sliced.meta.current_page);
    },
    [],
  );

  const applyAuxiliary = useCallback(
    (nextCourses: Course[], nextTargets: AudienceTarget[], nextGroups: AudienceGroup[]) => {
      setPickerCourses(nextCourses);
      setTargets(nextTargets);
      setGroups(nextGroups);
      setSelectedCourseIds((prev) =>
        prev.filter((id) => nextCourses.some((course) => course.id === id)),
      );
    },
    [],
  );

  const onPayload = useCallback(
    (payload: TrainingPayload) => {
      const nextCourses = Array.isArray(payload.courses) ? payload.courses : [];
      const nextTargets = Array.isArray(payload.targets) ? payload.targets : [];
      const nextGroups = Array.isArray(payload.groups) ? payload.groups : [];
      applyAuxiliary(nextCourses, nextTargets, nextGroups);
      setLiveEnrollments(Array.isArray(payload.enrollments) ? payload.enrollments : []);
    },
    [applyAuxiliary],
  );

  const refreshFromApi = useCallback(
    async (nextEnrollmentsPage: number, nextEnrollmentsPerPage: number) => {
      setError(null);
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        setError("Sign in required to manage training.");
        return;
      }
      setSession(me);
      const t = resolveTenant();
      const canTargets = hasPermission(me, "org.targets.manage");
      const canGroups = hasPermission(me, "org.groups.manage");
      const [pickerCourseRes, enrollmentRes, targetsRes, groupsRes] = await Promise.all([
        api<{ data: Course[] }>("/api/v1/org/training/courses?per_page=100", { tenant: t }),
        api(
          `/api/v1/org/training/enrollments?${paginationQuery(
            nextEnrollmentsPage,
            nextEnrollmentsPerPage,
            enrollmentFilters,
          )}`,
          { tenant: t },
        ),
        canTargets
          ? apiOptional<{ data: AudienceTarget[] }>("/api/v1/org/targets?per_page=500", {
              tenant: t,
            })
          : Promise.resolve(null),
        canGroups
          ? apiOptional<{ data: AudienceGroup[] }>("/api/v1/org/groups?per_page=500", {
              tenant: t,
            })
          : Promise.resolve(null),
      ]);
      const enrollmentsParsed = parsePaginatedResponse<EnrollmentRow>(
        enrollmentRes,
        nextEnrollmentsPerPage,
      );
      const pickerParsed = parsePaginatedResponse<Course>(pickerCourseRes, 100);
      const nextPicker = pickerParsed.data.length
        ? pickerParsed.data
        : (pickerCourseRes.data ?? []);
      const groupsParsed = groupsRes
        ? parsePaginatedResponse<AudienceGroup>(groupsRes, 500)
        : { data: [] as AudienceGroup[] };
      applyAuxiliary(
        nextPicker,
        targetsRes?.data ?? [],
        groupsParsed.data.length ? groupsParsed.data : (groupsRes?.data ?? []),
      );
      setEnrollments(enrollmentsParsed.data);
      setEnrollmentsMeta(enrollmentsParsed.meta);
      setEnrollmentsPage(enrollmentsParsed.meta.current_page);
    },
    [applyAuxiliary, enrollmentFilters],
  );

  const { status, error: liveError } = useLiveTopic<TrainingPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    setEnrollmentsPage(1);
  }, [enrollmentFilters]);

  useEffect(() => {
    if (liveEnrollments !== null) {
      // Group membership is not in the live enrollment snapshot; course/status filter client-side.
      // When a group filter is set, fall back to REST so results stay accurate.
      if (filterGroupId !== "") {
        void refreshFromApi(enrollmentsPage, enrollmentsPerPage)
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Failed to load training");
          })
          .finally(() => setLoading(false));
        return;
      }
      applyEnrollmentSlice(
        liveEnrollments,
        enrollmentsPage,
        enrollmentsPerPage,
        filterCourseId,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(enrollmentsPage, enrollmentsPerPage)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load training");
      })
      .finally(() => setLoading(false));
  }, [
    liveEnrollments,
    enrollmentsPage,
    enrollmentsPerPage,
    filterCourseId,
    filterGroupId,
    tableQuery.debounced,
    applyEnrollmentSlice,
    refreshFromApi,
  ]);

  const statusLabel = liveStatusLabel(status);

  function toggleCourse(courseId: number) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId],
    );
  }

  function toggleAllCourses() {
    if (selectedCourseIds.length === pickerCourses.length) {
      setSelectedCourseIds([]);
      return;
    }
    setSelectedCourseIds(pickerCourses.map((course) => course.id));
  }

  async function assignContent() {
    if (selectedTargetIds.length === 0 && selectedGroupIds.length === 0) {
      setError("Select at least one target or group.");
      return;
    }
    if (selectedCourseIds.length === 0) {
      setError("Select at least one course to assign.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      const body: Record<string, unknown> = {
        launch: true,
        course_ids: selectedCourseIds,
        name:
          selectedCourseIds.length === 1
            ? `Assign course ${selectedCourseIds[0]}`
            : `Assign ${selectedCourseIds.length} courses`,
      };
      if (selectedTargetIds.length > 0) body.target_ids = selectedTargetIds;
      if (selectedGroupIds.length > 0) body.group_ids = selectedGroupIds;

      const res = await api<{
        data: {
          assigned_target_ids: number[];
          course?: Course;
          courses?: Course[];
          campaigns?: unknown[];
        };
      }>("/api/v1/org/training/assign", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const courseCount = res.data.courses?.length ?? (res.data.course ? 1 : selectedCourseIds.length);
      toastSuccess(
        `Assigned ${courseCount} course(s) to ${res.data.assigned_target_ids.length} learner(s).`,
      );
      setSelectedCourseIds([]);
      if (liveEnrollments === null) {
        await refreshFromApi(enrollmentsPage, enrollmentsPerPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportReport(format: "csv" | "pdf" | "png") {
    setError(null);
    setExporting(format);
    try {
      if (format === "png") {
        const el = viewingReportRef.current;
        if (!el) throw new Error("Report panel not ready");
        await captureElementPng(el, "training-viewing-report.png");
        toastSuccess("Viewing report PNG downloaded.");
        return;
      }

      const exportParams = new URLSearchParams();
      if (filterCourseId !== "") exportParams.set("course_id", String(filterCourseId));
      if (filterGroupId !== "") exportParams.set("group_id", String(filterGroupId));
      for (const [key, value] of Object.entries(serializeDataTableQuery(tableQuery.debounced))) {
        exportParams.set(key, value);
      }
      const exportQs = exportParams.toString();
      const exportSuffix = exportQs ? `?${exportQs}` : "";
      const path =
        format === "csv"
          ? `/api/v1/org/training/enrollments/export${exportSuffix}`
          : `/api/v1/org/training/enrollments/export/pdf${exportSuffix}`;
      const accept = format === "csv" ? "text/csv" : "application/pdf";
      await downloadAuthenticated(
        path,
        `training-viewing-report.${format}`,
        accept,
      );
      toastSuccess(`Viewing report ${format.toUpperCase()} downloaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Training"
        description={
          statusLabel
            ? `Assign one or more courses to learners or groups, and review viewing detail. · ${statusLabel}`
            : "Assign one or more courses to learners or groups, and review viewing detail."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/courses" variant="secondary">
              Courses
            </LinkButton>
            {canManageCampaigns ? (
              <LinkButton href="/org/training/campaigns" variant="secondary">
                Campaigns
              </LinkButton>
            ) : null}
            <LinkButton href="/learn">Learner portal</LinkButton>
          </div>
        }
      />

      {error ? (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      ) : null}
      {liveError ? (
        <Alert className="mt-4" variant="destructive">
          {liveError}
        </Alert>
      ) : null}

      <Panel className="mt-6 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-medium">Assign content</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Select one or more existing courses, then send them to learners or groups.
            Create and edit courses on the Courses page.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Courses</Label>
            {pickerCourses.length > 0 ? (
              <Button type="button" variant="secondary" onClick={toggleAllCourses}>
                {selectedCourseIds.length === pickerCourses.length
                  ? "Clear all"
                  : "Select all"}
              </Button>
            ) : null}
          </div>
          {pickerCourses.length === 0 ? (
            <EmptyState
              title="No courses yet"
              description="Create courses first, then return here to assign them."
              action={
                <LinkButton href="/org/courses">Go to Courses</LinkButton>
              }
            />
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] p-3">
              {pickerCourses.map((course) => {
                const checked = selectedCourseIds.includes(course.id);
                return (
                  <label
                    key={course.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => toggleCourse(course.id)}
                    />
                    <span>
                      <span className="font-medium">{course.title}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                        {course.duration_minutes} min · {course.lessons?.length ?? 0}{" "}
                        lessons
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {selectedCourseIds.length > 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              {selectedCourseIds.length} course(s) selected
            </p>
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

        <Button type="button" onClick={() => void assignContent()} disabled={busy}>
          Assign now
        </Button>
      </Panel>

      <div ref={viewingReportRef} className="mt-6">
        <Panel className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Viewing report</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Per-learner lesson status, watch time, and open/complete timestamps.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void exportReport("csv")}
              >
                {exporting === "csv" ? "Exporting…" : "Export CSV"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void exportReport("pdf")}
              >
                {exporting === "pdf" ? "Exporting…" : "Export PDF"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void exportReport("png")}
              >
                {exporting === "png" ? "Exporting…" : "Export PNG"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="filter-course">Course</Label>
              <Select
                id="filter-course"
                value={filterCourseId === "" ? "" : String(filterCourseId)}
                onChange={(e) =>
                  setFilterCourseId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">All courses</option>
                {pickerCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-group">Group</Label>
              <Select
                id="filter-group"
                value={filterGroupId === "" ? "" : String(filterGroupId)}
                onChange={(e) =>
                  setFilterGroupId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <DataTable
            mode="server"
            caption="Training enrollments"
            filterState={tableQuery.state}
            onFilterStateChange={tableQuery.setState}
            rows={enrollments}
            getRowId={(row) => row.id}
            emptyTitle="No enrollments yet"
            emptyDescription="Assign courses or launch a training campaign."
            pagination={{
              page: enrollmentsPage,
              perPage: enrollmentsPerPage,
              total: enrollmentsMeta.total,
              onPageChange: setEnrollmentsPage,
              onPerPageChange: (size) => {
                setEnrollmentsPerPage(size);
                setEnrollmentsPage(1);
              },
            }}
            columns={
              [
                {
                  id: "learner",
                  header: "Learner",
                  sticky: true,
                  filterValue: (row) =>
                    `${row.target?.first_name ?? ""} ${row.target?.email ?? ""}`.trim(),
                  cell: (row) => (
                    <span>
                      {row.target?.first_name || row.target?.email || "—"}
                      {row.target?.email && row.target?.first_name ? (
                        <span className="mt-0.5 block whitespace-nowrap text-xs text-[var(--muted-foreground)]">
                          {row.target.email}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  id: "course",
                  header: "Course",
                  filterValue: (row) => row.course?.title,
                  cell: (row) => row.course?.title ?? "—",
                },
                {
                  id: "status",
                  header: "Status",
                  filter: "select",
                  filterOptions: [
                    { label: "Assigned", value: "assigned" },
                    { label: "In progress", value: "in_progress" },
                    { label: "Completed", value: "completed" },
                  ],
                  accessorKey: "status",
                  cell: (row) => <span className="capitalize">{row.status}</span>,
                },
                {
                  id: "progress",
                  header: "Progress",
                  filterValue: (row) => row.progress,
                  cell: (row) => `${row.progress}%`,
                },
                {
                  id: "opened",
                  header: "Opened",
                  filter: "none",
                  enableSorting: true,
                  filterValue: (row) => row.opened_at,
                  cell: (row) => formatTs(row.opened_at),
                },
                {
                  id: "completed",
                  header: "Completed",
                  filter: "none",
                  enableSorting: true,
                  filterValue: (row) => row.completed_at,
                  cell: (row) => formatTs(row.completed_at),
                },
                {
                  id: "quiz",
                  header: "Quiz",
                  filter: "none",
                  cell: (row) =>
                    row.quiz_score != null
                      ? `${row.quiz_score}%${row.quiz_passed ? " · pass" : ""}`
                      : "—",
                },
                {
                  id: "lessons",
                  header: "Lessons",
                  filter: "none",
                  enableSorting: false,
                  cell: (row) => {
                    const lessons = row.course?.lessons ?? [];
                    const expanded = expandedEnrollmentId === row.id;
                    return (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setExpandedEnrollmentId(expanded ? null : row.id)
                        }
                      >
                        {expanded ? "Hide" : `Detail (${lessons.length})`}
                      </Button>
                    );
                  },
                },
              ] satisfies Array<DataTableColumn<EnrollmentRow>>
            }
          />

          {expandedEnrollmentId != null
            ? (() => {
                const row = enrollments.find((item) => item.id === expandedEnrollmentId);
                if (!row) return null;
                const lessons = (row.course?.lessons ?? []).map((lesson) => {
                  const progress = row.lesson_progress?.find((p) => p.lesson_id === lesson.id);
                  return {
                    id: lesson.id,
                    title: lesson.title,
                    content_type: lesson.content_type,
                    status: progress?.status ?? "not_started",
                    progress_pct: progress?.progress_pct ?? 0,
                    watched_seconds: progress?.watched_seconds ?? 0,
                    opened_at: progress?.opened_at ?? null,
                    completed_at: progress?.completed_at ?? null,
                  };
                });
                return (
                  <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/30 p-3">
                    <h4 className="mb-2 text-sm font-medium">Lesson progress</h4>
                    <DataTable
                      mode="client"
                      caption="Lesson progress for enrollment"
                      rows={lessons}
                      getRowId={(lesson) => lesson.id}
                      emptyTitle="No lessons on this course."
                      columns={[
                        { id: "title", header: "Lesson", accessorKey: "title", cell: (l) => l.title },
                        {
                          id: "content_type",
                          header: "Type",
                          accessorKey: "content_type",
                          cell: (l) => l.content_type.toUpperCase(),
                        },
                        { id: "status", header: "Status", accessorKey: "status", cell: (l) => l.status },
                        {
                          id: "progress_pct",
                          header: "%",
                          filterValue: (l) => l.progress_pct,
                          cell: (l) => `${l.progress_pct}%`,
                        },
                        {
                          id: "watched_seconds",
                          header: "Watched (s)",
                          filterValue: (l) => l.watched_seconds,
                          cell: (l) => l.watched_seconds,
                        },
                        {
                          id: "opened_at",
                          header: "Opened",
                          filter: "none",
                          cell: (l) => formatTs(l.opened_at),
                        },
                        {
                          id: "completed_at",
                          header: "Completed",
                          filter: "none",
                          cell: (l) => formatTs(l.completed_at),
                        },
                      ]}
                    />
                  </div>
                );
              })()
            : null}
        </Panel>
      </div>
    </div>
  );
}
