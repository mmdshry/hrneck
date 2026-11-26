"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
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
import { matchesCells } from "@/lib/table-filter";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import {
  documentKind,
  isDocumentLesson,
  lessonHasPreviewableMedia,
  lessonMediaSrc,
  type Course,
  type Lesson,
} from "../training/training-shared";
import { CourseCreateDialog } from "./course-create-dialog";
import { CourseQuizEditor } from "./course-quiz-editor";
import { LessonAddDialog } from "./lesson-add-dialog";
import { QuickContentDialog } from "./quick-content-dialog";

type TrainingPayload = {
  courses: Course[];
  enrollments?: unknown[];
  targets?: unknown[];
  groups?: unknown[];
};

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
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [quickContentOpen, setQuickContentOpen] = useState(false);
  const [lessonAddOpen, setLessonAddOpen] = useState(false);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);
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

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  async function afterMutation() {
    if (liveCourses === null) {
      await refreshFromApi(coursesPage, coursesPerPage, filters);
    }
  }

  async function afterCourseCreated(course: Course) {
    await afterMutation();
    setSelectedId(course.id);
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
      throw err;
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
          <Button type="button" onClick={() => setCreateCourseOpen(true)}>
            {t("newCourse")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setQuickContentOpen(true)}
          >
            {t("newArticleVideo")}
          </Button>
        </div>
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
                        onClick={() => setLessonToDelete(lesson)}
                        disabled={busy}
                      >
                        {tCommon("delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setLessonAddOpen(true)}
                >
                  {t("addLesson")}
                </Button>
              </div>

              <LessonAddDialog
                open={lessonAddOpen}
                onOpenChange={setLessonAddOpen}
                courseId={selected.id}
                onAdded={afterMutation}
              />

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

      <CourseCreateDialog
        open={createCourseOpen}
        onOpenChange={setCreateCourseOpen}
        onCreated={afterCourseCreated}
      />

      <QuickContentDialog
        open={quickContentOpen}
        onOpenChange={setQuickContentOpen}
        onCreated={afterCourseCreated}
      />

      <ConfirmDialog
        open={lessonToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setLessonToDelete(null);
        }}
        title={t("deleteLesson")}
        description={t("deleteLessonConfirm", { title: lessonToDelete?.title ?? "" })}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        workingLabel={tCommon("working")}
        errorFallback={tCommon("deleteFailed")}
        variant="destructive"
        loading={busy}
        onConfirm={async () => {
          if (lessonToDelete) {
            await deleteLesson(lessonToDelete.id);
          }
        }}
      />

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
        {t("noMediaAttached")}
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
            {t("officeDownloadHint")}
          </p>
          <a
            href={src}
            download
            className="text-sm font-medium text-[var(--foreground)] underline"
          >
            {t("downloadDocument")}
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
