"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import {
  ApiError,
  NO_ASSIGNED_TRAINING_MESSAGE,
  api,
  ensureCsrf,
  fetchSessionUser,
} from "@/lib/api";
import { learnLiveChannel } from "@/lib/live-topics";
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

type QuizQuestion = {
  type?: "mcq" | "essay";
  prompt: string;
  options?: string[] | null;
};

type CourseQuiz = {
  id: number;
  title: string;
  pass_score: number;
  is_required?: boolean;
  time_limit_seconds?: number | null;
  questions: QuizQuestion[];
};

type Course = {
  id: number;
  title: string;
  description?: string | null;
  lessons?: Lesson[];
  quizzes?: CourseQuiz[];
  quiz?: CourseQuiz | null;
};

type QuizAnswer = number | string;

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

type EnrollmentRow = {
  id: number;
  course: string;
  status: string;
  progress: number;
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

type LearnPayload = {
  data: Enrollment[];
};

export function LearnClient() {
  const searchParams = useSearchParams();
  const courseParam = searchParams.get("course");
  const enrollmentParam = searchParams.get("enrollment");
  const targetParam = searchParams.get("target");

  const [userId, setUserId] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [liveEnrollments, setLiveEnrollments] = useState<Enrollment[] | null>(null);
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<number | null>(
    enrollmentParam ? Number(enrollmentParam) : null,
  );
  const [answersByQuiz, setAnswersByQuiz] = useState<
    Record<number, QuizAnswer[]>
  >({});
  const [startedAtByQuiz, setStartedAtByQuiz] = useState<
    Record<number, string>
  >({});
  const [remainingByQuiz, setRemainingByQuiz] = useState<
    Record<number, number>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingQuizId, setSubmittingQuizId] = useState<number | null>(null);
  const lastHeartbeat = useRef<Record<number, number>>({});
  const tenant = resolveTenant();
  const channel =
    tenant && userId != null ? learnLiveChannel(tenant, userId) : null;

  const enrollmentRows = useMemo<EnrollmentRow[]>(
    () =>
      enrollments.map((row) => ({
        id: row.id,
        course: row.course?.title ?? `Course #${row.course_id}`,
        status: row.status,
        progress: row.progress,
      })),
    [enrollments],
  );

  const active = useMemo(
    () =>
      enrollments.find((row) => row.id === activeEnrollmentId) ??
      enrollments[0] ??
      null,
    [enrollments, activeEnrollmentId],
  );
  const course = active?.course ?? null;
  const courseQuizzes = useMemo(() => {
    if (course?.quizzes && course.quizzes.length > 0) {
      return course.quizzes;
    }
    return course?.quiz ? [course.quiz] : [];
  }, [course]);

  const applyEnrollmentList = useCallback(
    (rows: Enrollment[]) => {
      setEnrollments(rows);
      if (rows.length === 0) {
        setError(NO_ASSIGNED_TRAINING_MESSAGE);
        return;
      }
      setError(null);
      if (enrollmentParam) {
        setActiveEnrollmentId(Number(enrollmentParam));
      } else if (courseParam) {
        const match = rows.find((row) => row.course_id === Number(courseParam));
        setActiveEnrollmentId(match?.id ?? rows[0].id);
      } else {
        setActiveEnrollmentId((current) =>
          current && rows.some((row) => row.id === current) ? current : rows[0].id,
        );
      }
    },
    [courseParam, enrollmentParam],
  );

  const onPayload = useCallback((payload: LearnPayload) => {
    setLiveEnrollments(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const loadAssignments = useCallback(async () => {
    setMessage(null);
    setError(null);
    try {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        setError("Sign in required to view assigned training.");
        setUserId(null);
        return;
      }
      setUserId(me.id);
      const params = new URLSearchParams();
      if (courseParam) params.set("course_id", courseParam);
      if (targetParam) params.set("target_id", targetParam);
      const qs = params.toString();
      const res = await api<{ data: Enrollment[] }>(
        `/api/v1/org/training/assignments${qs ? `?${qs}` : ""}`,
        { tenant },
      );
      applyEnrollmentList(res.data);
      setAnswersByQuiz({});
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(NO_ASSIGNED_TRAINING_MESSAGE);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
  }, [applyEnrollmentList, courseParam, targetParam, tenant]);

  const { status, error: liveError } = useLiveTopic<LearnPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveEnrollments !== null) {
      applyEnrollmentList(liveEnrollments);
      setLoading(false);
      return;
    }
    void loadAssignments().finally(() => setLoading(false));
  }, [liveEnrollments, applyEnrollmentList, loadAssignments]);

  const statusLabel = liveStatusLabel(status);

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

  function ensureQuizStarted(quiz: CourseQuiz) {
    if (startedAtByQuiz[quiz.id]) return;
    const started = new Date().toISOString();
    setStartedAtByQuiz((prev) => ({ ...prev, [quiz.id]: started }));
    if (quiz.time_limit_seconds) {
      setRemainingByQuiz((prev) => ({
        ...prev,
        [quiz.id]: quiz.time_limit_seconds!,
      }));
    }
  }

  useEffect(() => {
    const timed = courseQuizzes.filter(
      (quiz) => quiz.time_limit_seconds && startedAtByQuiz[quiz.id],
    );
    if (timed.length === 0) return;
    const timer = window.setInterval(() => {
      setRemainingByQuiz((prev) => {
        const next = { ...prev };
        for (const quiz of timed) {
          const started = startedAtByQuiz[quiz.id];
          if (!started || !quiz.time_limit_seconds) continue;
          const elapsed = Math.floor(
            (Date.now() - new Date(started).getTime()) / 1000,
          );
          next[quiz.id] = Math.max(0, quiz.time_limit_seconds - elapsed);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [courseQuizzes, startedAtByQuiz]);

  async function submitQuiz(quiz: CourseQuiz) {
    if (!active) return;
    ensureQuizStarted(quiz);
    const answers = answersByQuiz[quiz.id] ?? [];
    for (const [index, question] of quiz.questions.entries()) {
      const answer = answers[index];
      if (question.type === "essay") {
        if (typeof answer !== "string" || !answer.trim()) {
          setError(`Write an answer for essay question ${index + 1}.`);
          return;
        }
        continue;
      }
      if (typeof answer !== "number" || answer < 0) {
        setError(`Select an answer for question ${index + 1}.`);
        return;
      }
    }
    if (
      quiz.time_limit_seconds &&
      (remainingByQuiz[quiz.id] ?? quiz.time_limit_seconds) <= 0
    ) {
      setError("Time limit exceeded for this quiz.");
      return;
    }

    setSubmittingQuizId(quiz.id);
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
          quiz_id: quiz.id,
          target_id: active.target_id,
          enrollment_id: active.id,
          answers,
          started_at: startedAtByQuiz[quiz.id] ?? new Date().toISOString(),
        }),
      });
      setMessage(
        `${quiz.title}: score ${res.data.score}% · ${res.data.passed ? "passed" : "retry"}`,
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
      setSubmittingQuizId(null);
    }
  }

  function lessonDone(lessonId: number): boolean {
    return (
      active?.lesson_progress?.some(
        (row) => row.lesson_id === lessonId && row.status === "completed",
      ) ?? false
    );
  }

  function selectEnrollment(id: number) {
    setActiveEnrollmentId(id);
    setAnswersByQuiz({});
    setStartedAtByQuiz({});
    setRemainingByQuiz({});
    setMessage(null);
  }

  const enrollmentColumns: Array<DataTableColumn<EnrollmentRow>> = [
    {
      id: "course",
      header: "Course",
      accessorKey: "course",
      sticky: true,
      cell: (row) => (
        <button
          type="button"
          className={`text-left ${row.id === active?.id ? "font-medium" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            selectEnrollment(row.id);
          }}
        >
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{row.course}</span>
            {row.id === active?.id ? (
              <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Current
              </span>
            ) : null}
          </span>
        </button>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (row) => row.status,
    },
    {
      id: "progress",
      header: "Progress",
      accessorKey: "progress",
      filterValue: (row) => row.progress,
      cell: (row) => `${row.progress}%`,
    },
  ];

  if (loading && enrollments.length === 0 && !error) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <PageHeader
        title={course?.title ?? "Learner portal"}
        description={
          statusLabel
            ? `${course?.description ?? "Open assigned awareness training and complete the quiz."} · ${statusLabel}`
            : (course?.description ??
              "Open assigned awareness training and complete the quiz.")
        }
        actions={
          <>
            <NotificationBell />
            <ThemeToggle />
          </>
        }
      />

      {enrollments.length > 1 ? (
        <DataTable
          className="mt-4"
          mode="client"
          caption="Assigned courses"
          columns={enrollmentColumns}
          rows={enrollmentRows}
          getRowId={(row) => row.id}
          onRowClick={(row) => selectEnrollment(row.id)}
          emptyTitle="No assigned courses"
          emptyFilteredTitle="No matching courses"
        />
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
                <div className="aspect-video overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
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
                  className="w-full rounded-[var(--radius)] border border-[var(--border)]"
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
                  className="h-[28rem] w-full rounded-[var(--radius)] border border-[var(--border)]"
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

      {courseQuizzes.map((quiz) => {
        const answers = answersByQuiz[quiz.id] ?? [];
        const remaining = remainingByQuiz[quiz.id];
        const started = Boolean(startedAtByQuiz[quiz.id]);
        return (
          <Panel key={quiz.id} className="mt-6 space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium">{quiz.title}</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Pass {quiz.pass_score}%
                  {quiz.is_required === false ? " · optional" : " · required"}
                  {quiz.time_limit_seconds
                    ? ` · ${quiz.time_limit_seconds}s limit`
                    : ""}
                </p>
              </div>
              {quiz.time_limit_seconds ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                  {started
                    ? `Time left: ${remaining ?? quiz.time_limit_seconds}s`
                    : "Timer starts when you answer"}
                </div>
              ) : null}
            </div>
            {quiz.questions.map((question, questionIndex) => {
              const isEssay = question.type === "essay";
              return (
                <fieldset
                  key={`${quiz.id}-${questionIndex}`}
                  className="space-y-2"
                  onFocus={() => ensureQuizStarted(quiz)}
                >
                  <legend className="text-sm font-medium">
                    {question.prompt}
                    {isEssay ? (
                      <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                        Essay · not scored
                      </span>
                    ) : null}
                  </legend>
                  {isEssay ? (
                    <textarea
                      className="min-h-24 w-full rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                      value={typeof answers[questionIndex] === "string" ? answers[questionIndex] : ""}
                      onChange={(e) => {
                        ensureQuizStarted(quiz);
                        setAnswersByQuiz((prev) => {
                          const next = [...(prev[quiz.id] ?? [])];
                          next[questionIndex] = e.target.value;
                          return { ...prev, [quiz.id]: next };
                        });
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {(question.options ?? []).map((option, optionIndex) => {
                        const selected = answers[questionIndex] === optionIndex;
                        return (
                          <label
                            key={option}
                            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
                          >
                            <input
                              type="radio"
                              name={`q-${quiz.id}-${questionIndex}`}
                              checked={selected}
                              onChange={() => {
                                ensureQuizStarted(quiz);
                                setAnswersByQuiz((prev) => {
                                  const next = [...(prev[quiz.id] ?? [])];
                                  next[questionIndex] = optionIndex;
                                  return { ...prev, [quiz.id]: next };
                                });
                              }}
                              className="h-4 w-4 accent-[var(--primary)]"
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              );
            })}
            <Button
              type="button"
              onClick={() => void submitQuiz(quiz)}
              disabled={submittingQuizId === quiz.id}
            >
              {submittingQuizId === quiz.id ? "Submitting…" : "Submit quiz"}
            </Button>
          </Panel>
        );
      })}

      {liveError ? (
        <Alert className="mt-4" variant="destructive">
          {liveError}
        </Alert>
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
