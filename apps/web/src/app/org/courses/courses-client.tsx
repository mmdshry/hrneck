"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
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
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastSuccess, toastWarning, toastError } from "@/lib/toast";
import {
  documentKind,
  emptyLessonForm,
  emptyQuickContentForm,
  isDocumentLesson,
  isTimedMediaLesson,
  isUploadableContentType,
  lessonHasPreviewableMedia,
  lessonMediaSrc,
  mediaAcceptForContentType,
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
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
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
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const canManageCampaigns = hasPermission(session, "org.campaigns.manage");

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
      
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        toastWarning(t("signInRequired"));
        return;
      }
      setSession(me);
      const tenantSlug = resolveTenant();
      const courseRes = await api(
        `/api/v1/org/training/courses?${paginationQuery(nextCoursesPage, nextCoursesPerPage, nextFilters)}`,
        { tenant: tenantSlug },
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
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

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
        toastError(err instanceof Error ? err.message : t("failedLoad"));
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
      toastWarning(t("courseTitleRequired"));
      return;
    }
    setBusy(true);
    
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
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function createQuickContent() {
    if (!quickForm.title.trim()) {
      toastWarning(t("contentTitleRequired"));
      return;
    }
    setBusy(true);
    
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      let mediaMeta: {
        media_disk_path?: string;
        media_mime?: string;
        media_size?: number;
      } = {};
      if (quickUpload && isUploadableContentType(quickForm.content_type)) {
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
            isTimedMediaLesson(quickForm) && quickForm.duration_seconds
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
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addLesson() {
    if (!selected) return;
    if (!lessonForm.title.trim()) {
      toastWarning(t("lessonTitleRequired"));
      return;
    }
    setBusy(true);
    
    try {
      await ensureCsrf();
      let mediaMeta: {
        media_disk_path?: string;
        media_mime?: string;
        media_size?: number;
      } = {};

      if (uploadFile && isUploadableContentType(lessonForm.content_type)) {
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
            isTimedMediaLesson(lessonForm) && lessonForm.duration_seconds
              ? Number(lessonForm.duration_seconds)
              : null,
        }),
      });
      setLessonForm(emptyLessonForm);
      setUploadFile(null);
      toastSuccess(t("lessonAdded"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("lessonCreateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteLesson(lessonId: number) {
    if (!selected) return;
    setBusy(true);
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/training/courses/${selected.id}/lessons/${lessonId}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess(t("lessonDeleted"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse() {
    if (!selected) return;
    setBusy(true);
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/training/courses/${selected.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess(t("courseDeleted"));
      setSelectedId(null);
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const courseColumns: Array<DataTableColumn<Course>> = [
    {
      id: "title",
      header: tCommon("titleLabel"),
      accessorKey: "title",
      sticky: true,
      cell: (course) => (
        <span className={selectedId === course.id ? "font-medium" : undefined}>{course.title}</span>
      ),
    },
    {
      id: "duration_minutes",
      header: tCommon("minutes"),
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
        title={t("title")}
        description={
          statusLabel ? `${t("description")} · ${statusLabel}` : t("description")
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/training" variant="secondary">
              {tNav("training")}
            </LinkButton>
            {canManageCampaigns ? (
              <LinkButton href="/org/training/campaigns" variant="secondary">
                {tNav("campaigns")}
              </LinkButton>
            ) : null}
          </div>
        }
      />

      
      

      <Panel className="mt-6 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-medium">{t("createContent")}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("createContentHint")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={createMode === "course" ? "default" : "secondary"}
            onClick={() => setCreateMode("course")}
          >
            {t("newCourse")}
          </Button>
          <Button
            type="button"
            variant={createMode === "quick" ? "default" : "secondary"}
            onClick={() => setCreateMode("quick")}
          >
            {t("newArticleVideo")}
          </Button>
        </div>

        {createMode === "course" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="course-title">{tCommon("titleLabel")}</Label>
                <Input
                  id="course-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("titlePlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="course-duration">{t("durationMinutes")}</Label>
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
              <Label htmlFor="course-description">{tCommon("descriptionLabel")}</Label>
              <Textarea
                id="course-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="button" onClick={() => void createCourse()} disabled={busy}>
              {t("createCourse")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="quick-title">{tCommon("titleLabel")}</Label>
                <Input
                  id="quick-title"
                  value={quickForm.title}
                  onChange={(e) =>
                    setQuickForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder={t("lessonTitlePlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quick-type">{tCommon("type")}</Label>
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
                  <option value="text">{t("textArticle")}</option>
                  <option value="video">{t("video")}</option>
                  <option value="audio">{t("audio")}</option>
                  <option value="document">{t("document")}</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-description">{t("descriptionOptional")}</Label>
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
                <Label htmlFor="quick-body">{tCommon("body")}</Label>
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
              <div className="space-y-1">
                <Label htmlFor="quick-url">{t("youtubeVimeoUrl")}</Label>
                <Input
                  id="quick-url"
                  value={quickForm.media_url}
                  onChange={(e) =>
                    setQuickForm((prev) => ({ ...prev, media_url: e.target.value }))
                  }
                />
              </div>
            ) : null}
            {isTimedMediaLesson(quickForm) ? (
              <div className="space-y-1">
                <Label htmlFor="quick-duration">{t("durationSeconds")}</Label>
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
            ) : null}
            {isUploadableContentType(quickForm.content_type) ? (
              <div className="space-y-1">
                <Label htmlFor="quick-file">
                  {quickForm.content_type === "document"
                    ? t("uploadDocument")
                    : quickForm.content_type === "audio"
                      ? t("uploadAudio")
                      : t("uploadVideo")}
                </Label>
                <Input
                  id="quick-file"
                  type="file"
                  accept={mediaAcceptForContentType(quickForm.content_type)}
                  onChange={(e) => setQuickUpload(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}
            <Button type="button" onClick={() => void createQuickContent()} disabled={busy}>
              {t("createContent")}
            </Button>
          </div>
        )}
      </Panel>

      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(20rem,28rem)_1fr]">
        <Panel className="min-w-0 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("libraryCaption")}
          </h2>
          <DataTable
            mode="server"
            caption={t("libraryCaption")}
            columns={courseColumns}
            rows={courses}
            filterState={tableQuery.state}
            onFilterStateChange={tableQuery.setState}
            getRowId={(row) => row.id}
            onRowClick={(course) => setSelectedId(course.id)}
            emptyTitle={t("noCourses")}
            emptyDescription={t("noCoursesHint")}
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
                    {selected.description || t("noDescription")} ·{" "}
                    {t("courseMeta", {
                      minutes: selected.duration_minutes,
                      count: selected.lessons?.length ?? 0,
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-0 px-2 py-1 text-xs"
                  disabled={busy}
                  onClick={() => setConfirmDeleteCourse(true)}
                >
                  {t("deleteCourse")}
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
                        {lesson.media_url ? ` · ${t("external")}` : ""}
                        {lesson.media_disk_path ? ` · ${t("uploaded")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {lessonHasPreviewableMedia(lesson) ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-0 px-2 py-1 text-xs"
                          onClick={() => setPreviewLesson(lesson)}
                        >
                          {tCommon("preview")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void deleteLesson(lesson.id)}
                        disabled={busy}
                      >
                        {tCommon("delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <h3 className="text-sm font-medium">{t("addLesson")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="lesson-title">{tCommon("titleLabel")}</Label>
                    <Input
                      id="lesson-title"
                      value={lessonForm.title}
                      onChange={(e) =>
                        setLessonForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lesson-type">{tCommon("type")}</Label>
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
                      <option value="text">{t("textArticle")}</option>
                      <option value="video">{t("video")}</option>
                      <option value="audio">{t("audio")}</option>
                      <option value="document">{t("document")}</option>
                    </Select>
                  </div>
                </div>

                {lessonForm.content_type === "text" ? (
                  <div className="space-y-1">
                    <Label htmlFor="lesson-body">{tCommon("body")}</Label>
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
                  <div className="space-y-1">
                    <Label htmlFor="lesson-url">{t("youtubeVimeoUrl")}</Label>
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
                ) : null}

                {isTimedMediaLesson(lessonForm) ? (
                  <div className="space-y-1">
                    <Label htmlFor="lesson-duration">{t("durationSeconds")}</Label>
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
                ) : null}

                {isUploadableContentType(lessonForm.content_type) ? (
                  <div className="space-y-1">
                    <Label htmlFor="lesson-file">
                      {lessonForm.content_type === "document"
                        ? t("uploadDocument")
                        : lessonForm.content_type === "audio"
                          ? t("uploadAudio")
                          : t("uploadVideo")}
                    </Label>
                    <Input
                      id="lesson-file"
                      type="file"
                      accept={mediaAcceptForContentType(lessonForm.content_type)}
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                ) : null}

                <Button type="button" onClick={() => void addLesson()} disabled={busy}>
                  {t("addLesson")}
                </Button>
              </div>

              <CourseQuizEditor
                courseId={selected.id}
                quizzes={selected.quizzes ?? (selected.quiz ? [selected.quiz] : [])}
                busy={busy}
                setBusy={setBusy}
                onChanged={async () => {
                  await afterMutation();
                }}
              />
            </Panel>
          ) : (
            <EmptyState
              title={t("selectCourse")}
              description={t("selectCourseHint")}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteCourse}
        onOpenChange={setConfirmDeleteCourse}
        title={t("deleteCourse")}
        description={t("deleteCourseConfirm", { title: selected?.title ?? "" })}
        confirmLabel={t("deleteCourse")}
        variant="destructive"
        loading={busy}
        onConfirm={async () => {
          await deleteCourse();
        }}
      />

      <Dialog
        open={previewLesson != null}
        onOpenChange={(open) => {
          if (!open) setPreviewLesson(null);
        }}
        title={previewLesson?.title ?? t("lessonPreview")}
        description={t("lessonPreviewHint")}
        size="lg"
        className="max-w-3xl"
      >
        {previewLesson ? (
          <LessonPreviewBody lesson={previewLesson} tenant={tenant} />
        ) : null}
      </Dialog>
    </div>
  );
}

function LessonPreviewBody({
  lesson,
  tenant,
}: {
  lesson: Lesson;
  tenant: string;
}) {
  const t = useTranslations("org.courses");
  const src = lessonMediaSrc(lesson, tenant);

  if (lesson.content_type === "text") {
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[var(--foreground)]">
        {lesson.body?.trim() || t("noArticleBody")}
      </div>
    );
  }

  if (!src) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No media attached to this lesson.
      </p>
    );
  }

  if (lesson.content_type === "audio") {
    return <audio key={src} controls className="w-full" src={src} />;
  }

  if (isDocumentLesson(lesson)) {
    const kind = documentKind(lesson);
    if (kind === "office") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Word documents open via download; browsers cannot preview them inline.
          </p>
          <a
            href={src}
            download
            className="text-sm font-medium text-[var(--foreground)] underline"
          >
            Download document
          </a>
        </div>
      );
    }
    if (kind === "text") {
      return (
        <iframe
          title={lesson.title}
          src={src}
          className="h-[70vh] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]"
        />
      );
    }
    return (
      <iframe
        title={lesson.title}
        src={src}
        className="h-[70vh] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]"
      />
    );
  }

  if (lesson.content_type === "video" && lesson.media_disk_path) {
    return (
      <video
        key={src}
        controls
        className="max-h-[70vh] w-full rounded-[var(--radius)] bg-black"
        src={src}
      />
    );
  }

  return (
    <iframe
      title={lesson.title}
      src={src}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="aspect-video h-auto w-full rounded-[var(--radius)] border border-[var(--border)] bg-black"
    />
  );
}
