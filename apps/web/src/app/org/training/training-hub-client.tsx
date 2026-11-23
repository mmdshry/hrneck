"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { toastSuccess, toastWarning, toastError } from "@/lib/toast";
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
  const t = useTranslations("org.training");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
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
      
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        toastWarning(t("signInRequired"));
        return;
      }
      setSession(me);
      const tenantSlug = resolveTenant();
      const canTargets = hasPermission(me, "org.targets.manage");
      const canGroups = hasPermission(me, "org.groups.manage");
      const [pickerCourseRes, enrollmentRes, targetsRes, groupsRes] = await Promise.all([
        api<{ data: Course[] }>("/api/v1/org/training/courses?per_page=100", {
          tenant: tenantSlug,
        }),
        api(
          `/api/v1/org/training/enrollments?${paginationQuery(
            nextEnrollmentsPage,
            nextEnrollmentsPerPage,
            enrollmentFilters,
          )}`,
          { tenant: tenantSlug },
        ),
        canTargets
          ? apiOptional<{ data: AudienceTarget[] }>("/api/v1/org/targets?per_page=500", {
              tenant: tenantSlug,
            })
          : Promise.resolve(null),
        canGroups
          ? apiOptional<{ data: AudienceGroup[] }>("/api/v1/org/groups?per_page=500", {
              tenant: tenantSlug,
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
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

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
            toastError(err instanceof Error ? err.message : t("failedLoad"));
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
        toastError(err instanceof Error ? err.message : t("failedLoad"));
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
      toastWarning(t("selectTargetOrGroup"));
      return;
    }
    if (selectedCourseIds.length === 0) {
      toastWarning(t("selectCourse"));
      return;
    }

    setBusy(true);
    
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
      toastError(err instanceof Error ? err.message : t("assignFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function exportReport(format: "csv" | "pdf" | "png") {
    
    setExporting(format);
    try {
      if (format === "png") {
        const el = viewingReportRef.current;
        if (!el) throw new Error(t("reportPanelNotReady"));
        await captureElementPng(el, "training-viewing-report.png");
        toastSuccess(t("viewingReportDownloaded"));
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
      toastError(err instanceof Error ? err.message : tCommon("exportFailed"));
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
        title={t("title")}
        description={
          statusLabel ? `${t("description")} · ${statusLabel}` : t("description")
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/courses" variant="secondary">
              {tNav("courses")}
            </LinkButton>
            {canManageCampaigns ? (
              <LinkButton href="/org/training/campaigns" variant="secondary">
                {tNav("campaigns")}
              </LinkButton>
            ) : null}
            <LinkButton href="/learn">{tNav("learnerPortal")}</LinkButton>
          </div>
        }
      />

      
      

      <Panel className="mt-6 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-medium">{t("assignContent")}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("assignContentHint")}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{tNav("courses")}</Label>
            {pickerCourses.length > 0 ? (
              <Button type="button" variant="secondary" onClick={toggleAllCourses}>
                {selectedCourseIds.length === pickerCourses.length
                  ? tCommon("clearAll")
                  : tCommon("selectAll")}
              </Button>
            ) : null}
          </div>
          {pickerCourses.length === 0 ? (
            <EmptyState
              title={t("noCoursesYet")}
              description={t("noCoursesHint")}
              action={
                <LinkButton href="/org/courses">{t("goToCourses")}</LinkButton>
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
                        {t("courseMetaShort", {
                          minutes: course.duration_minutes,
                          count: course.lessons?.length ?? 0,
                        })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {selectedCourseIds.length > 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("coursesSelected", { count: selectedCourseIds.length })}
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
          {t("assignNow")}
        </Button>
      </Panel>

      <div ref={viewingReportRef} className="mt-6">
        <Panel className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">{t("viewingReport")}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("viewingReportHint")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void exportReport("csv")}
              >
                {exporting === "csv" ? tCommon("exporting") : tCommon("exportCsv")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void exportReport("pdf")}
              >
                {exporting === "pdf" ? tCommon("exporting") : tCommon("exportPdf")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void exportReport("png")}
              >
                {exporting === "png" ? tCommon("exporting") : tCommon("exportPng")}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="filter-course">{tCommon("course")}</Label>
              <Select
                id="filter-course"
                value={filterCourseId === "" ? "" : String(filterCourseId)}
                onChange={(e) =>
                  setFilterCourseId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">{t("allCourses")}</option>
                {pickerCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-group">{tCommon("group")}</Label>
              <Select
                id="filter-group"
                value={filterGroupId === "" ? "" : String(filterGroupId)}
                onChange={(e) =>
                  setFilterGroupId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">{t("allGroups")}</option>
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
            caption={t("enrollmentsCaption")}
            filterState={tableQuery.state}
            onFilterStateChange={tableQuery.setState}
            rows={enrollments}
            getRowId={(row) => row.id}
            emptyTitle={t("noEnrollmentsYet")}
            emptyDescription={t("noEnrollmentsHint")}
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
                  header: tCommon("learner"),
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
                  header: tCommon("course"),
                  filterValue: (row) => row.course?.title,
                  cell: (row) => row.course?.title ?? "—",
                },
                {
                  id: "status",
                  header: tCommon("status"),
                  filter: "select",
                  filterOptions: [
                    { label: tCommon("assigned"), value: "assigned" },
                    { label: tCommon("inProgress"), value: "in_progress" },
                    { label: tCommon("completed"), value: "completed" },
                  ],
                  accessorKey: "status",
                  cell: (row) => <span className="capitalize">{row.status}</span>,
                },
                {
                  id: "progress",
                  header: tCommon("progress"),
                  filterValue: (row) => row.progress,
                  cell: (row) => `${row.progress}%`,
                },
                {
                  id: "opened",
                  header: tCommon("opened"),
                  filter: "none",
                  enableSorting: true,
                  filterValue: (row) => row.opened_at,
                  cell: (row) => formatTs(row.opened_at),
                },
                {
                  id: "completed",
                  header: tCommon("completed"),
                  filter: "none",
                  enableSorting: true,
                  filterValue: (row) => row.completed_at,
                  cell: (row) => formatTs(row.completed_at),
                },
                {
                  id: "quiz",
                  header: tCommon("quiz"),
                  filter: "none",
                  cell: (row) =>
                    row.quiz_score != null
                      ? `${row.quiz_score}%${row.quiz_passed ? t("quizPassedSuffix") : ""}`
                      : tCommon("emDash"),
                },
                {
                  id: "lessons",
                  header: tCommon("lessons"),
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
                        {expanded ? tCommon("hide") : tCommon("details")}
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
                    <h4 className="mb-2 text-sm font-medium">{t("lessonProgressTitle")}</h4>
                    <DataTable
                      mode="client"
                      caption={t("lessonProgressTitle")}
                      rows={lessons}
                      getRowId={(lesson) => lesson.id}
                      emptyTitle={t("noLessonsOnCourse")}
                      columns={[
                        { id: "title", header: tCommon("lesson"), accessorKey: "title", cell: (l) => l.title },
                        {
                          id: "content_type",
                          header: tCommon("type"),
                          accessorKey: "content_type",
                          cell: (l) => l.content_type.toUpperCase(),
                        },
                        { id: "status", header: tCommon("status"), accessorKey: "status", cell: (l) => l.status },
                        {
                          id: "progress_pct",
                          header: "%",
                          filterValue: (l) => l.progress_pct,
                          cell: (l) => `${l.progress_pct}%`,
                        },
                        {
                          id: "watched_seconds",
                          header: tCommon("watchedSeconds"),
                          filterValue: (l) => l.watched_seconds,
                          cell: (l) => l.watched_seconds,
                        },
                        {
                          id: "opened_at",
                          header: tCommon("opened"),
                          filter: "none",
                          cell: (l) => formatTs(l.opened_at),
                        },
                        {
                          id: "completed_at",
                          header: tCommon("completed"),
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
