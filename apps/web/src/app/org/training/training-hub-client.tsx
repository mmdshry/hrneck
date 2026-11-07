"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  captureElementPng,
  downloadAuthenticated,
} from "@/lib/download";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastSuccess } from "@/lib/toast";
import {
  AudiencePicker,
  type AudienceGroup,
  type AudienceTarget,
} from "./audience-picker";

type Lesson = {
  id: number;
  title: string;
  content_type: "text" | "video" | "pdf";
  body?: string | null;
  media_url?: string | null;
  media_disk_path?: string | null;
  duration_seconds?: number | null;
  sort_order: number;
};

type Course = {
  id: number;
  title: string;
  description?: string | null;
  duration_minutes: number;
  lessons?: Lesson[];
  quiz?: {
    id: number;
    title: string;
    pass_score: number;
    questions: { prompt: string; options: string[]; correct_index: number }[];
  } | null;
};

type LessonProgressRow = {
  lesson_id: number;
  status: string;
  progress_pct: number;
  watched_seconds?: number;
  opened_at?: string | null;
  completed_at?: string | null;
};

type EnrollmentRow = {
  id: number;
  status: string;
  progress: number;
  opened_at?: string | null;
  completed_at?: string | null;
  quiz_passed?: boolean;
  quiz_score?: number | null;
  course?: { id: number; title: string; lessons?: Lesson[] } | null;
  target?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  lesson_progress?: LessonProgressRow[];
};

const emptyLessonForm = {
  title: "",
  content_type: "text" as Lesson["content_type"],
  body: "",
  media_url: "",
  duration_seconds: "",
};

const emptyAssignForm = {
  title: "",
  content_type: "text" as Lesson["content_type"],
  body: "",
  media_url: "",
  duration_seconds: "",
  description: "",
};

function formatTs(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function TrainingHubClient() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesMeta, setCoursesMeta] = useState<PaginationMeta>(emptyMeta());
  const [coursesPage, setCoursesPage] = useState(1);
  const [coursesPerPage, setCoursesPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [pickerCourses, setPickerCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [enrollmentsMeta, setEnrollmentsMeta] = useState<PaginationMeta>(emptyMeta());
  const [enrollmentsPage, setEnrollmentsPage] = useState(1);
  const [enrollmentsPerPage, setEnrollmentsPerPage] =
    useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [targets, setTargets] = useState<AudienceTarget[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("8");
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);
  const [assignUpload, setAssignUpload] = useState<File | null>(null);
  const [assignCourseId, setAssignCourseId] = useState<number | "">("");
  const [assignMode, setAssignMode] = useState<"existing" | "content">("content");
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [filterCourseId, setFilterCourseId] = useState<number | "">("");
  const [filterGroupId, setFilterGroupId] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | "png" | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false);
  const viewingReportRef = useRef<HTMLDivElement>(null);

  const selected =
    courses.find((c) => c.id === selectedId) ??
    pickerCourses.find((c) => c.id === selectedId) ??
    null;

  const enrollmentFilters = useMemo(
    () => ({
      course_id: filterCourseId === "" ? undefined : filterCourseId,
      group_id: filterGroupId === "" ? undefined : filterGroupId,
      status: filterStatus || undefined,
    }),
    [filterCourseId, filterGroupId, filterStatus],
  );

  async function refresh(
    nextCoursesPage = coursesPage,
    nextCoursesPerPage = coursesPerPage,
    nextEnrollmentsPage = enrollmentsPage,
    nextEnrollmentsPerPage = enrollmentsPerPage,
  ) {
    setError(null);
    try {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        setError("Sign in required to manage training.");
        return;
      }
      const tenant = resolveTenant();
      const [courseRes, pickerCourseRes, enrollmentRes, targetsRes, groupsRes] =
        await Promise.all([
          api(
            `/api/v1/org/training/courses?${paginationQuery(nextCoursesPage, nextCoursesPerPage)}`,
            { tenant },
          ),
          api<{ data: Course[] }>("/api/v1/org/training/courses?per_page=100", { tenant }),
          api(
            `/api/v1/org/training/enrollments?${paginationQuery(
              nextEnrollmentsPage,
              nextEnrollmentsPerPage,
              enrollmentFilters,
            )}`,
            { tenant },
          ),
          api<{ data: AudienceTarget[] }>("/api/v1/org/targets?per_page=500", {
            tenant,
          }),
          api<{ data: AudienceGroup[] }>("/api/v1/org/groups?per_page=500", { tenant }),
        ]);
      const coursesParsed = parsePaginatedResponse<Course>(courseRes, nextCoursesPerPage);
      const enrollmentsParsed = parsePaginatedResponse<EnrollmentRow>(
        enrollmentRes,
        nextEnrollmentsPerPage,
      );
      const pickerParsed = parsePaginatedResponse<Course>(pickerCourseRes, 100);
      setCourses(coursesParsed.data);
      setCoursesMeta(coursesParsed.meta);
      setCoursesPage(coursesParsed.meta.current_page);
      setPickerCourses(
        pickerParsed.data.length ? pickerParsed.data : (pickerCourseRes.data ?? []),
      );
      setEnrollments(enrollmentsParsed.data);
      setEnrollmentsMeta(enrollmentsParsed.meta);
      setEnrollmentsPage(enrollmentsParsed.meta.current_page);
      setTargets(targetsRes.data ?? []);
      const groupsParsed = parsePaginatedResponse<AudienceGroup>(groupsRes, 500);
      setGroups(groupsParsed.data.length ? groupsParsed.data : (groupsRes.data ?? []));
      if (!selectedId && coursesParsed.data[0]) {
        setSelectedId(coursesParsed.data[0].id);
      }
      if (assignCourseId === "" && pickerParsed.data[0]) {
        setAssignCourseId(pickerParsed.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training");
    }
  }

  useEffect(() => {
    setEnrollmentsPage(1);
  }, [enrollmentFilters]);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentFilters, coursesPage, coursesPerPage, enrollmentsPage, enrollmentsPerPage]);

  async function createCourse() {
    if (!title.trim()) {
      setError("Course title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      const res = await api<{ data: Course }>("/api/v1/org/training/courses", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          duration_minutes: Number(duration) || 8,
          is_sample: false,
        }),
      });
      setTitle("");
      setDescription("");
      setDuration("8");
      toastSuccess(`Created “${res.data.title}”.`);
      await refresh();
      setSelectedId(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadMedia(
    file: File,
    contentType: "video" | "pdf",
  ): Promise<{
    media_disk_path: string;
    media_mime: string;
    media_size: number;
  }> {
    const form = new FormData();
    form.append("file", file);
    form.append("content_type", contentType);
    const uploaded = await api<{
      data: {
        media_disk_path: string;
        media_mime: string;
        media_size: number;
      };
    }>("/api/v1/org/training/media/upload", {
      method: "POST",
      tenant: resolveTenant(),
      body: form,
    });
    return uploaded.data;
  }

  async function addLesson() {
    if (!selected) return;
    if (!lessonForm.title.trim()) {
      setError("Lesson title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      let mediaMeta: {
        media_disk_path?: string;
        media_mime?: string;
        media_size?: number;
      } = {};

      if (
        uploadFile &&
        (lessonForm.content_type === "video" || lessonForm.content_type === "pdf")
      ) {
        mediaMeta = await uploadMedia(uploadFile, lessonForm.content_type);
      }

      await api(`/api/v1/org/training/courses/${selected.id}/lessons`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lessonForm.title.trim(),
          content_type: lessonForm.content_type,
          body: lessonForm.content_type === "text" ? lessonForm.body : "",
          media_url:
            lessonForm.content_type === "video" && !mediaMeta.media_disk_path
              ? lessonForm.media_url.trim() || null
              : null,
          media_disk_path: mediaMeta.media_disk_path ?? null,
          media_mime: mediaMeta.media_mime ?? null,
          media_size: mediaMeta.media_size ?? null,
          duration_seconds:
            lessonForm.content_type === "video" && lessonForm.duration_seconds
              ? Number(lessonForm.duration_seconds)
              : null,
        }),
      });
      setLessonForm(emptyLessonForm);
      setUploadFile(null);
      toastSuccess("Lesson added.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lesson create failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLesson(lessonId: number) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/training/courses/${selected.id}/lessons/${lessonId}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess("Lesson deleted.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/training/courses/${selected.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess("Course deleted.");
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function assignContent() {
    if (selectedTargetIds.length === 0 && selectedGroupIds.length === 0) {
      setError("Select at least one target or group.");
      return;
    }
    if (assignMode === "existing" && assignCourseId === "") {
      setError("Select a course to assign.");
      return;
    }
    if (assignMode === "content" && !assignForm.title.trim()) {
      setError("Content title is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      const body: Record<string, unknown> = {
        launch: true,
      };
      if (selectedTargetIds.length > 0) body.target_ids = selectedTargetIds;
      if (selectedGroupIds.length > 0) body.group_ids = selectedGroupIds;

      if (assignMode === "existing") {
        body.course_id = assignCourseId;
        body.name = `Assign course ${assignCourseId}`;
      } else {
        let mediaMeta: {
          media_disk_path?: string;
          media_mime?: string;
          media_size?: number;
        } = {};
        if (
          assignUpload &&
          (assignForm.content_type === "video" || assignForm.content_type === "pdf")
        ) {
          mediaMeta = await uploadMedia(assignUpload, assignForm.content_type);
        }
        body.name = `Assign: ${assignForm.title.trim()}`;
        body.content = {
          title: assignForm.title.trim(),
          description: assignForm.description.trim() || null,
          content_type: assignForm.content_type,
          body: assignForm.content_type === "text" ? assignForm.body : "",
          media_url:
            assignForm.content_type === "video" && !mediaMeta.media_disk_path
              ? assignForm.media_url.trim() || null
              : null,
          media_disk_path: mediaMeta.media_disk_path ?? null,
          media_mime: mediaMeta.media_mime ?? null,
          media_size: mediaMeta.media_size ?? null,
          duration_seconds:
            assignForm.content_type === "video" && assignForm.duration_seconds
              ? Number(assignForm.duration_seconds)
              : null,
        };
      }

      const res = await api<{
        data: { assigned_target_ids: number[]; course?: Course };
      }>("/api/v1/org/training/assign", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setAssignForm(emptyAssignForm);
      setAssignUpload(null);
      toastSuccess(
        `Assigned to ${res.data.assigned_target_ids.length} learner(s)${
          res.data.course?.title ? ` · ${res.data.course.title}` : ""
        }.`,
      );
      await refresh();
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
      if (filterStatus) exportParams.set("status", filterStatus);
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
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Training"
        description="Create courses, assign articles or videos to users/groups, and review viewing detail."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void refresh()}>
              Refresh
            </Button>
            <LinkButton href="/org/training/campaigns" variant="secondary">
              Campaigns
            </LinkButton>
            <LinkButton href="/learn">Learner portal</LinkButton>
          </div>
        }
      />

      {error ? (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      ) : null}

      <Panel className="mt-6 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-medium">Assign content</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Send an existing course or a single article/video (as a one-lesson course) to
            selected learners or groups.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={assignMode === "content" ? "default" : "secondary"}
            onClick={() => setAssignMode("content")}
          >
            New article / video
          </Button>
          <Button
            type="button"
            variant={assignMode === "existing" ? "default" : "secondary"}
            onClick={() => setAssignMode("existing")}
          >
            Existing course
          </Button>
        </div>

        {assignMode === "existing" ? (
          <div className="space-y-1">
            <Label htmlFor="assign-course">Course</Label>
            <Select
              id="assign-course"
              value={assignCourseId === "" ? "" : String(assignCourseId)}
              onChange={(e) =>
                setAssignCourseId(e.target.value ? Number(e.target.value) : "")
              }
            >
              {pickerCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="assign-title">Title</Label>
                <Input
                  id="assign-title"
                  value={assignForm.title}
                  onChange={(e) =>
                    setAssignForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Password hygiene tip"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="assign-type">Type</Label>
                <Select
                  id="assign-type"
                  value={assignForm.content_type}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      content_type: e.target.value as Lesson["content_type"],
                    }))
                  }
                >
                  <option value="text">Text / article</option>
                  <option value="video">Video</option>
                  <option value="pdf">PDF</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="assign-description">Description (optional)</Label>
              <Input
                id="assign-description"
                value={assignForm.description}
                onChange={(e) =>
                  setAssignForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            {assignForm.content_type === "text" ? (
              <div className="space-y-1">
                <Label htmlFor="assign-body">Body</Label>
                <Textarea
                  id="assign-body"
                  rows={4}
                  value={assignForm.body}
                  onChange={(e) =>
                    setAssignForm((prev) => ({ ...prev, body: e.target.value }))
                  }
                />
              </div>
            ) : null}
            {assignForm.content_type === "video" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="assign-url">YouTube / Vimeo URL</Label>
                  <Input
                    id="assign-url"
                    value={assignForm.media_url}
                    onChange={(e) =>
                      setAssignForm((prev) => ({ ...prev, media_url: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="assign-duration">Duration (seconds)</Label>
                  <Input
                    id="assign-duration"
                    type="number"
                    min={0}
                    value={assignForm.duration_seconds}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        duration_seconds: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
            {assignForm.content_type === "video" || assignForm.content_type === "pdf" ? (
              <div className="space-y-1">
                <Label htmlFor="assign-file">
                  {assignForm.content_type === "pdf" ? "Upload PDF" : "Or upload video file"}
                </Label>
                <Input
                  id="assign-file"
                  type="file"
                  accept={
                    assignForm.content_type === "pdf"
                      ? "application/pdf"
                      : "video/mp4,video/webm,video/quicktime"
                  }
                  onChange={(e) => setAssignUpload(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}
          </div>
        )}

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

      <Panel className="mt-6 space-y-3 p-5">
        <h2 className="text-lg font-medium">New course</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="course-title">Title</Label>
            <Input
              id="course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Security fundamentals"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="course-duration">Duration (minutes)</Label>
            <Input
              id="course-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="course-description">Description</Label>
          <Textarea
            id="course-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <Button type="button" onClick={() => void createCourse()} disabled={busy}>
          Create course
        </Button>
      </Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-[240px_1fr]">
        <Panel className="p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Courses
          </h2>
          {courses.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No courses"
              description="Create a course to add lessons."
            />
          ) : (
            <ul className="mt-3 space-y-1">
              {courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedId === course.id
                        ? "bg-[var(--muted)] font-medium"
                        : "hover:bg-[var(--muted)]"
                    }`}
                    onClick={() => setSelectedId(course.id)}
                  >
                    {course.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            className="mt-3"
            page={coursesPage}
            perPage={coursesPerPage}
            total={coursesMeta.total}
            onPageChange={setCoursesPage}
            onPerPageChange={(size) => {
              setCoursesPerPage(size);
              setCoursesPage(1);
            }}
          />
        </Panel>

        <div className="space-y-4">
          {selected ? (
            <Panel className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">{selected.title}</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {selected.description || "No description"} · {selected.duration_minutes}{" "}
                    min · {selected.lessons?.length ?? 0} lessons
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-0 px-2 py-1 text-xs"
                  disabled={busy}
                  onClick={() => setConfirmDeleteCourse(true)}
                >
                  Delete course
                </Button>
              </div>

              <div className="space-y-2">
                {(selected.lessons ?? []).map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{lesson.title}</p>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                        {lesson.content_type}
                        {lesson.media_url ? " · external" : ""}
                        {lesson.media_disk_path ? " · uploaded" : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void deleteLesson(lesson.id)}
                      disabled={busy}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <h3 className="text-sm font-medium">Add lesson</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="lesson-title">Title</Label>
                    <Input
                      id="lesson-title"
                      value={lessonForm.title}
                      onChange={(e) =>
                        setLessonForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lesson-type">Type</Label>
                    <Select
                      id="lesson-type"
                      value={lessonForm.content_type}
                      onChange={(e) =>
                        setLessonForm((prev) => ({
                          ...prev,
                          content_type: e.target.value as Lesson["content_type"],
                        }))
                      }
                    >
                      <option value="text">Text / article</option>
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                    </Select>
                  </div>
                </div>

                {lessonForm.content_type === "text" ? (
                  <div className="space-y-1">
                    <Label htmlFor="lesson-body">Body</Label>
                    <Textarea
                      id="lesson-body"
                      rows={4}
                      value={lessonForm.body}
                      onChange={(e) =>
                        setLessonForm((prev) => ({ ...prev, body: e.target.value }))
                      }
                    />
                  </div>
                ) : null}

                {lessonForm.content_type === "video" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="lesson-url">YouTube / Vimeo URL</Label>
                      <Input
                        id="lesson-url"
                        value={lessonForm.media_url}
                        onChange={(e) =>
                          setLessonForm((prev) => ({
                            ...prev,
                            media_url: e.target.value,
                          }))
                        }
                        placeholder="https://www.youtube.com/watch?v=…"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lesson-duration">Duration (seconds)</Label>
                      <Input
                        id="lesson-duration"
                        type="number"
                        min={0}
                        value={lessonForm.duration_seconds}
                        onChange={(e) =>
                          setLessonForm((prev) => ({
                            ...prev,
                            duration_seconds: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {lessonForm.content_type === "video" ||
                lessonForm.content_type === "pdf" ? (
                  <div className="space-y-1">
                    <Label htmlFor="lesson-file">
                      {lessonForm.content_type === "pdf"
                        ? "Upload PDF"
                        : "Or upload video file"}
                    </Label>
                    <Input
                      id="lesson-file"
                      type="file"
                      accept={
                        lessonForm.content_type === "pdf"
                          ? "application/pdf"
                          : "video/mp4,video/webm,video/quicktime"
                      }
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                ) : null}

                <Button type="button" onClick={() => void addLesson()} disabled={busy}>
                  Add lesson
                </Button>
              </div>
            </Panel>
          ) : (
            <EmptyState
              title="Select a course"
              description="Pick a course on the left or create one above."
            />
          )}

          <div ref={viewingReportRef}>
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

            <div className="grid gap-3 sm:grid-cols-3">
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
              <div className="space-y-1">
                <Label htmlFor="filter-status">Status</Label>
                <Select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>
            </div>

            {enrollments.length === 0 ? (
              <EmptyState
                className="mt-2"
                title="No enrollments yet"
                description="Assign content or launch a training campaign."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">Training enrollments</caption>
                  <thead className="text-[var(--muted-foreground)]">
                    <tr>
                      <th scope="col" className="pb-2 font-medium">
                        Learner
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Course
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Status
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Progress
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Opened
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Completed
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Quiz
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Lessons
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((row) => {
                      const lessons = row.course?.lessons ?? [];
                      const expanded = expandedEnrollmentId === row.id;
                      return (
                        <Fragment key={row.id}>
                          <tr className="border-t border-[var(--border)]">
                            <td className="py-2">
                              {row.target?.first_name || row.target?.email || "—"}
                              {row.target?.email && row.target?.first_name ? (
                                <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                                  {row.target.email}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2">{row.course?.title ?? "—"}</td>
                            <td className="py-2 capitalize">{row.status}</td>
                            <td className="py-2">{row.progress}%</td>
                            <td className="py-2 text-xs">{formatTs(row.opened_at)}</td>
                            <td className="py-2 text-xs">{formatTs(row.completed_at)}</td>
                            <td className="py-2">
                              {row.quiz_score != null
                                ? `${row.quiz_score}%${row.quiz_passed ? " · pass" : ""}`
                                : "—"}
                            </td>
                            <td className="py-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                  setExpandedEnrollmentId(expanded ? null : row.id)
                                }
                              >
                                {expanded ? "Hide" : `Detail (${lessons.length})`}
                              </Button>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr className="border-t border-[var(--border)] bg-[var(--muted)]/40">
                              <td colSpan={8} className="px-3 py-3">
                                {lessons.length === 0 ? (
                                  <p className="text-sm text-[var(--muted-foreground)]">
                                    No lessons on this course.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[640px] text-left text-xs">
                                      <caption className="sr-only">
                                        Lesson progress for enrollment
                                      </caption>
                                      <thead className="text-[var(--muted-foreground)]">
                                        <tr>
                                          <th scope="col" className="pb-2 font-medium">
                                            Lesson
                                          </th>
                                          <th scope="col" className="pb-2 font-medium">
                                            Type
                                          </th>
                                          <th scope="col" className="pb-2 font-medium">
                                            Status
                                          </th>
                                          <th scope="col" className="pb-2 font-medium">
                                            %
                                          </th>
                                          <th scope="col" className="pb-2 font-medium">
                                            Watched (s)
                                          </th>
                                          <th scope="col" className="pb-2 font-medium">
                                            Opened
                                          </th>
                                          <th scope="col" className="pb-2 font-medium">
                                            Completed
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lessons.map((lesson) => {
                                          const progress = row.lesson_progress?.find(
                                            (p) => p.lesson_id === lesson.id,
                                          );
                                          return (
                                            <tr
                                              key={lesson.id}
                                              className="border-t border-[var(--border)]"
                                            >
                                              <td className="py-1.5">{lesson.title}</td>
                                              <td className="py-1.5 uppercase">
                                                {lesson.content_type}
                                              </td>
                                              <td className="py-1.5">
                                                {progress?.status ?? "not_started"}
                                              </td>
                                              <td className="py-1.5">
                                                {progress?.progress_pct ?? 0}%
                                              </td>
                                              <td className="py-1.5">
                                                {progress?.watched_seconds ?? 0}
                                              </td>
                                              <td className="py-1.5">
                                                {formatTs(progress?.opened_at)}
                                              </td>
                                              <td className="py-1.5">
                                                {formatTs(progress?.completed_at)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              className="mt-3"
              page={enrollmentsPage}
              perPage={enrollmentsPerPage}
              total={enrollmentsMeta.total}
              onPageChange={setEnrollmentsPage}
              onPerPageChange={(size) => {
                setEnrollmentsPerPage(size);
                setEnrollmentsPage(1);
              }}
            />
            </Panel>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteCourse}
        onOpenChange={setConfirmDeleteCourse}
        title="Delete course"
        description={`Delete course “${selected?.title}”? Lessons will be removed.`}
        confirmLabel="Delete course"
        variant="destructive"
        loading={busy}
        onConfirm={async () => {
          await deleteCourse();
        }}
      />
    </div>
  );
}
