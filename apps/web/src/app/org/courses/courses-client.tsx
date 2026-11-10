"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
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
import { resolveTenant } from "@/lib/tenant";
import { toastSuccess } from "@/lib/toast";
import {
  emptyLessonForm,
  emptyQuickContentForm,
  uploadTrainingMedia,
  type Course,
  type Lesson,
} from "../training/training-shared";
import { CourseQuizEditor } from "./course-quiz-editor";

type TrainingPayload = {
  courses: Course[];
  enrollments?: unknown[];
  targets?: unknown[];
  groups?: unknown[];
};

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

function courseCells(course: Course): Record<string, string> {
  return {
    title: course.title,
    description: course.description ?? "",
    duration_minutes: String(course.duration_minutes),
  };
}

export function CoursesClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "training") : null;
  const [courses, setCourses] = useState<Course[]>([]);
  const [liveCourses, setLiveCourses] = useState<Course[] | null>(null);
  const [coursesMeta, setCoursesMeta] = useState<PaginationMeta>(emptyMeta());
  const [coursesPage, setCoursesPage] = useState(1);
  const [coursesPerPage, setCoursesPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("8");
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [quickForm, setQuickForm] = useState(emptyQuickContentForm);
  const [quickUpload, setQuickUpload] = useState<File | null>(null);
  const [createMode, setCreateMode] = useState<"course" | "quick">("course");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false);

  const selected = courses.find((c) => c.id === selectedId) ?? null;

  const applyLiveSlice = useCallback(
    (
      items: Course[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((course) =>
        matchesCells(q, columnFilters, courseCells(course)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setCourses(sliced.data);
      setCoursesMeta(sliced.meta);
      setCoursesPage(sliced.meta.current_page);
      setSelectedId((current) => {
        if (current && sliced.data.some((course) => course.id === current)) return current;
        if (current && filtered.some((course) => course.id === current)) return current;
        return sliced.data[0]?.id ?? filtered[0]?.id ?? null;
      });
    },
    [],
  );

  const onPayload = useCallback((payload: TrainingPayload) => {
    setLiveCourses(Array.isArray(payload.courses) ? payload.courses : []);
  }, []);

  const refreshFromApi = useCallback(
    async (
      nextCoursesPage: number,
      nextCoursesPerPage: number,
      nextFilters: Record<string, string>,
    ) => {
      setError(null);
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        setError("Sign in required to manage courses.");
        return;
      }
      const t = resolveTenant();
      const courseRes = await api(
        `/api/v1/org/training/courses?${paginationQuery(nextCoursesPage, nextCoursesPerPage, nextFilters)}`,
        { tenant: t },
      );
      const coursesParsed = parsePaginatedResponse<Course>(courseRes, nextCoursesPerPage);
      setCourses(coursesParsed.data);
      setCoursesMeta(coursesParsed.meta);
      setCoursesPage(coursesParsed.meta.current_page);
      setSelectedId((current) => {
        if (!current && coursesParsed.data[0]) return coursesParsed.data[0].id;
        if (current && !coursesParsed.data.some((course) => course.id === current)) {
          return coursesParsed.data[0]?.id ?? null;
        }
        return current;
      });
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<TrainingPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (coursesPage !== 1) {
        setCoursesPage(1);
        return;
      }
    }
    if (liveCourses !== null) {
      applyLiveSlice(
        liveCourses,
        coursesPage,
        coursesPerPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(coursesPage, coursesPerPage, filters)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load courses");
      })
      .finally(() => setLoading(false));
  }, [
    liveCourses,
    coursesPage,
    coursesPerPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function afterMutation() {
    if (liveCourses === null) {
      await refreshFromApi(coursesPage, coursesPerPage, filters);
    }
  }

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
      await afterMutation();
      setSelectedId(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function createQuickContent() {
    if (!quickForm.title.trim()) {
      setError("Content title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      let mediaMeta: {
        media_disk_path?: string;
        media_mime?: string;
        media_size?: number;
      } = {};
      if (
        quickUpload &&
        (quickForm.content_type === "video" || quickForm.content_type === "pdf")
      ) {
        mediaMeta = await uploadTrainingMedia(quickUpload, quickForm.content_type);
      }

      const courseRes = await api<{ data: Course }>("/api/v1/org/training/courses", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickForm.title.trim(),
          description: quickForm.description.trim() || null,
          duration_minutes: Number(quickForm.duration_minutes) || 8,
          is_sample: false,
        }),
      });

      await api(`/api/v1/org/training/courses/${courseRes.data.id}/lessons`, {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickForm.title.trim(),
          content_type: quickForm.content_type,
          body: quickForm.content_type === "text" ? quickForm.body : "",
          media_url:
            quickForm.content_type === "video" && !mediaMeta.media_disk_path
              ? quickForm.media_url.trim() || null
              : null,
          media_disk_path: mediaMeta.media_disk_path ?? null,
          media_mime: mediaMeta.media_mime ?? null,
          media_size: mediaMeta.media_size ?? null,
          duration_seconds:
            quickForm.content_type === "video" && quickForm.duration_seconds
              ? Number(quickForm.duration_seconds)
              : null,
        }),
      });

      setQuickForm(emptyQuickContentForm);
      setQuickUpload(null);
      toastSuccess(`Created “${courseRes.data.title}” with one lesson.`);
      await afterMutation();
      setSelectedId(courseRes.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
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
        mediaMeta = await uploadTrainingMedia(uploadFile, lessonForm.content_type);
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
      await afterMutation();
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
      await afterMutation();
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
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const courseColumns: Array<DataTableColumn<Course>> = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      sticky: true,
      cell: (course) => (
        <span className={selectedId === course.id ? "font-medium" : undefined}>{course.title}</span>
      ),
    },
    {
      id: "duration_minutes",
      header: "Minutes",
      filter: "none",
      filterValue: (course) => course.duration_minutes,
      cell: (course) => course.duration_minutes,
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Courses"
        description={
          statusLabel
            ? `Create courses, add article/video/PDF lessons, and manage the course library. · ${statusLabel}`
            : "Create courses, add article/video/PDF lessons, and manage the course library."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/training" variant="secondary">
              Training
            </LinkButton>
            <LinkButton href="/org/training/campaigns" variant="secondary">
              Campaigns
            </LinkButton>
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
          <h2 className="text-lg font-medium">Create content</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Build a multi-lesson course, or create a one-lesson article/video/PDF.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={createMode === "course" ? "default" : "secondary"}
            onClick={() => setCreateMode("course")}
          >
            New course
          </Button>
          <Button
            type="button"
            variant={createMode === "quick" ? "default" : "secondary"}
            onClick={() => setCreateMode("quick")}
          >
            New article / video
          </Button>
        </div>

        {createMode === "course" ? (
          <div className="space-y-3">
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
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="quick-title">Title</Label>
                <Input
                  id="quick-title"
                  value={quickForm.title}
                  onChange={(e) =>
                    setQuickForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Password hygiene tip"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quick-type">Type</Label>
                <Select
                  id="quick-type"
                  value={quickForm.content_type}
                  onChange={(e) =>
                    setQuickForm((prev) => ({
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
              <Label htmlFor="quick-description">Description (optional)</Label>
              <Input
                id="quick-description"
                value={quickForm.description}
                onChange={(e) =>
                  setQuickForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            {quickForm.content_type === "text" ? (
              <div className="space-y-1">
                <Label htmlFor="quick-body">Body</Label>
                <Textarea
                  id="quick-body"
                  rows={4}
                  value={quickForm.body}
                  onChange={(e) =>
                    setQuickForm((prev) => ({ ...prev, body: e.target.value }))
                  }
                />
              </div>
            ) : null}
            {quickForm.content_type === "video" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="quick-url">YouTube / Vimeo URL</Label>
                  <Input
                    id="quick-url"
                    value={quickForm.media_url}
                    onChange={(e) =>
                      setQuickForm((prev) => ({ ...prev, media_url: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quick-duration">Duration (seconds)</Label>
                  <Input
                    id="quick-duration"
                    type="number"
                    min={0}
                    value={quickForm.duration_seconds}
                    onChange={(e) =>
                      setQuickForm((prev) => ({
                        ...prev,
                        duration_seconds: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
            {quickForm.content_type === "video" || quickForm.content_type === "pdf" ? (
              <div className="space-y-1">
                <Label htmlFor="quick-file">
                  {quickForm.content_type === "pdf" ? "Upload PDF" : "Or upload video file"}
                </Label>
                <Input
                  id="quick-file"
                  type="file"
                  accept={
                    quickForm.content_type === "pdf"
                      ? "application/pdf"
                      : "video/mp4,video/webm,video/quicktime"
                  }
                  onChange={(e) => setQuickUpload(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}
            <Button type="button" onClick={() => void createQuickContent()} disabled={busy}>
              Create content
            </Button>
          </div>
        )}
      </Panel>

      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(20rem,28rem)_1fr]">
        <Panel className="min-w-0 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Course library
          </h2>
          <DataTable
            mode="server"
            caption="Course library"
            columns={courseColumns}
            rows={courses}
            filterState={tableQuery.state}
            onFilterStateChange={tableQuery.setState}
            getRowId={(row) => row.id}
            onRowClick={(course) => setSelectedId(course.id)}
            emptyTitle="No courses"
            emptyDescription="Create a course to add lessons."
            pagination={{
              page: coursesPage,
              perPage: coursesPerPage,
              total: coursesMeta.total,
              onPageChange: setCoursesPage,
              onPerPageChange: (size) => {
                setCoursesPerPage(size);
                setCoursesPage(1);
              },
            }}
          />
        </Panel>

        <div className="min-w-0 space-y-4">
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
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
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

              <CourseQuizEditor
                courseId={selected.id}
                quizzes={selected.quizzes ?? (selected.quiz ? [selected.quiz] : [])}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                onChanged={async () => {
                  await afterMutation();
                }}
              />
            </Panel>
          ) : (
            <EmptyState
              title="Select a course"
              description="Pick a course on the left or create one above."
            />
          )}
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
