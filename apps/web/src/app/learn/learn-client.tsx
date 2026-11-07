"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import {
  ApiError,
  NO_ASSIGNED_TRAINING_MESSAGE,
  api,
  ensureCsrf,
  fetchSessionUser,
} from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  paginateLocal,
  type PageSize,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";

type Lesson = {
  id: number;
  title: string;
  content_type?: "text" | "video" | "pdf";
  body?: string | null;
  media_url?: string | null;
  media_disk_path?: string | null;
  duration_seconds?: number | null;
};

type Course = {
  id: number;
  title: string;
  description?: string | null;
  lessons?: Lesson[];
  quiz?: {
    id: number;
    questions: { prompt: string; options: string[] }[];
  } | null;
};

type Enrollment = {
  id: number;
  target_id: number;
  course_id: number;
  status: string;
  progress: number;
  course?: Course | null;
  lesson_progress?: {
    lesson_id: number;
    status: string;
    progress_pct: number;
  }[];
};

function youtubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function vimeoEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("vimeo.com")) return null;
    const id = parsed.pathname.split("/").filter(Boolean).pop();
    return id ? `https://player.vimeo.com/video/${id}` : null;
  } catch {
    return null;
  }
}

function mediaSrc(lesson: Lesson, tenant: string): string | null {
  if (lesson.media_disk_path) {
    return `/api/v1/org/training/media/${lesson.id}?tenant=${encodeURIComponent(tenant)}`;
  }
  if (lesson.media_url) {
    return (
      youtubeEmbed(lesson.media_url) ||
      vimeoEmbed(lesson.media_url) ||
      lesson.media_url
    );
  }
  return null;
}

export function LearnClient() {
  const searchParams = useSearchParams();
  const courseParam = searchParams.get("course");
  const enrollmentParam = searchParams.get("enrollment");
  const targetParam = searchParams.get("target");

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<number | null>(
    enrollmentParam ? Number(enrollmentParam) : null,
  );
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [answers, setAnswers] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const lastHeartbeat = useRef<Record<number, number>>({});

  const enrollmentPage = useMemo(
    () => paginateLocal(enrollments, page, perPage),
    [enrollments, page, perPage],
  );

  const active = useMemo(
    () =>
      enrollments.find((row) => row.id === activeEnrollmentId) ??
      enrollments[0] ??
      null,
    [enrollments, activeEnrollmentId],
  );
  const course = active?.course ?? null;
  const tenant = resolveTenant();

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        setError("Sign in required to view assigned training.");
        return;
      }
      const params = new URLSearchParams();
      if (courseParam) params.set("course_id", courseParam);
      if (targetParam) params.set("target_id", targetParam);
      const qs = params.toString();
      const res = await api<{ data: Enrollment[] }>(
        `/api/v1/org/training/assignments${qs ? `?${qs}` : ""}`,
        { tenant },
      );
      setEnrollments(res.data);
      if (res.data.length === 0) {
        setError(NO_ASSIGNED_TRAINING_MESSAGE);
      } else if (enrollmentParam) {
        setActiveEnrollmentId(Number(enrollmentParam));
      } else if (courseParam) {
        const match = res.data.find((row) => row.course_id === Number(courseParam));
        setActiveEnrollmentId(match?.id ?? res.data[0].id);
      } else {
        setActiveEnrollmentId(res.data[0].id);
      }
      setAnswers([]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(NO_ASSIGNED_TRAINING_MESSAGE);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, [courseParam, enrollmentParam, targetParam, tenant]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  async function reportLessonProgress(
    lesson: Lesson,
    payload: {
      progress_pct?: number;
      watched_seconds?: number;
      completed?: boolean;
      opened?: boolean;
    },
  ) {
    if (!active) return;
    try {
      await ensureCsrf();
      const res = await api<{
        data: { enrollment: Enrollment; lesson_progress: unknown };
      }>("/api/v1/org/training/progress/lesson", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: active.id,
          lesson_id: lesson.id,
          ...payload,
        }),
      });
      setEnrollments((prev) =>
        prev.map((row) =>
          row.id === res.data.enrollment.id
            ? { ...row, ...res.data.enrollment, course: row.course }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Progress update failed");
    }
  }

  async function markComplete(lesson: Lesson) {
    await reportLessonProgress(lesson, { completed: true, progress_pct: 100 });
    setMessage(`Marked “${lesson.title}” complete.`);
  }

  function onVideoTime(lesson: Lesson, currentTime: number, duration: number) {
    const now = Date.now();
    const last = lastHeartbeat.current[lesson.id] ?? 0;
    if (now - last < 10000 && currentTime < duration - 1) return;
    lastHeartbeat.current[lesson.id] = now;
    const pct = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
    void reportLessonProgress(lesson, {
      watched_seconds: Math.floor(currentTime),
      progress_pct: pct,
      opened: true,
      completed: pct >= 80,
    });
  }

  async function submitQuiz() {
    if (!course?.quiz || !active) return;
    const expected = course.quiz.questions.length;
    if (answers.length !== expected || answers.some((value) => value < 0)) {
      setError("Select an answer for every question before submitting.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await ensureCsrf();
      const res = await api<{
        data: { score: number; passed: boolean; enrollment?: Enrollment | null };
      }>("/api/v1/org/training/quiz", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: course.quiz.id,
          target_id: active.target_id,
          enrollment_id: active.id,
          answers,
        }),
      });
      setMessage(
        `Quiz score ${res.data.score}% · ${res.data.passed ? "passed" : "retry"}`,
      );
      if (res.data.enrollment) {
        setEnrollments((prev) =>
          prev.map((row) =>
            row.id === res.data.enrollment!.id
              ? { ...row, ...res.data.enrollment!, course: row.course }
              : row,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz failed");
    } finally {
      setSubmitting(false);
    }
  }

  function lessonDone(lessonId: number): boolean {
    return (
      active?.lesson_progress?.some(
        (row) => row.lesson_id === lessonId && row.status === "completed",
      ) ?? false
    );
  }

  if (loading && enrollments.length === 0 && !error) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <PageHeader
        title={course?.title ?? "Learner portal"}
        description={
          course?.description ??
          "Open assigned awareness training and complete the quiz."
        }
        actions={
          <>
            <NotificationBell />
            <ThemeToggle />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadAssignments()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh assignments"}
            </Button>
          </>
        }
      />

      {enrollments.length > 1 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {enrollmentPage.data.map((row) => (
              <Button
                key={row.id}
                type="button"
                variant={row.id === active?.id ? "default" : "secondary"}
                onClick={() => {
                  setActiveEnrollmentId(row.id);
                  setAnswers([]);
                  setMessage(null);
                }}
              >
                {row.course?.title ?? `Course #${row.course_id}`}
              </Button>
            ))}
          </div>
          <Pagination
            page={page}
            perPage={perPage}
            total={enrollmentPage.meta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </div>
      ) : null}

      {active ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Progress {active.progress}% · status {active.status}
        </p>
      ) : null}

      {course?.lessons && course.lessons.length > 0 ? (
        course.lessons.map((lesson) => {
          const type = lesson.content_type ?? "text";
          const src = mediaSrc(lesson, tenant);
          const embed = lesson.media_url
            ? youtubeEmbed(lesson.media_url) || vimeoEmbed(lesson.media_url)
            : null;
          const done = lessonDone(lesson.id);

          return (
            <Panel key={lesson.id} className="mt-6 space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{lesson.title}</h2>
                <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {type}
                  {done ? " · completed" : ""}
                </span>
              </div>

              {type === "text" ? (
                <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
                  {lesson.body}
                </p>
              ) : null}

              {type === "video" && embed ? (
                <div className="aspect-video overflow-hidden rounded-xl border border-[var(--border)]">
                  <iframe
                    title={lesson.title}
                    src={embed}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => {
                      void reportLessonProgress(lesson, { opened: true, progress_pct: 1 });
                    }}
                  />
                </div>
              ) : null}

              {type === "video" && !embed && src ? (
                <video
                  className="w-full rounded-xl border border-[var(--border)]"
                  controls
                  src={src}
                  onPlay={() => {
                    void reportLessonProgress(lesson, { opened: true, progress_pct: 1 });
                  }}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    onVideoTime(lesson, el.currentTime, el.duration || lesson.duration_seconds || 0);
                  }}
                />
              ) : null}

              {type === "pdf" && src ? (
                <iframe
                  title={lesson.title}
                  src={src}
                  className="h-[28rem] w-full rounded-xl border border-[var(--border)]"
                  onLoad={() => {
                    void reportLessonProgress(lesson, { opened: true, progress_pct: 1 });
                  }}
                />
              ) : null}

              {(type === "text" || type === "pdf" || (type === "video" && embed)) && !done ? (
                <Button type="button" variant="secondary" onClick={() => void markComplete(lesson)}>
                  Mark as complete
                </Button>
              ) : null}
            </Panel>
          );
        })
      ) : (
        <EmptyState
          className="mt-6"
          title="No lessons yet"
          description="Load assignments after a training campaign enrolls you."
        />
      )}

      {course?.quiz ? (
        <Panel className="mt-6 space-y-5 p-5">
          <h2 className="text-lg font-medium">Quiz</h2>
          {course.quiz.questions.map((question, questionIndex) => (
            <fieldset key={question.prompt} className="space-y-2">
              <legend className="text-sm font-medium">{question.prompt}</legend>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const selected = answers[questionIndex] === optionIndex;
                  return (
                    <label
                      key={option}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
                    >
                      <input
                        type="radio"
                        name={`q-${questionIndex}`}
                        checked={selected}
                        onChange={() => {
                          setAnswers((prev) => {
                            const next = [...prev];
                            next[questionIndex] = optionIndex;
                            return next;
                          });
                        }}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <Button type="button" onClick={() => void submitQuiz()} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit quiz"}
          </Button>
        </Panel>
      ) : null}

      {error ? (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert className="mt-4" variant="success">
          {message}
        </Alert>
      ) : null}
    </div>
  );
}
