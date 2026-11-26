"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastError, toastInfo, toastWarning } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import {
  ApiError,
  NO_ASSIGNED_TRAINING_MESSAGE,
  api,
  ensureCsrf,
  fetchSessionUser,
} from "@/lib/api";
import { learnLiveChannel } from "@/lib/live-topics";
import { resolveTenant } from "@/lib/tenant";
import {
  documentKind,
  isDocumentLesson,
  lessonMediaSrc,
  lessonVideoEmbed,
  type LessonContentType,
} from "@/app/org/training/training-shared";

type Lesson = {
  id: number;
  title: string;
  content_type?: LessonContentType;
  body?: string | null;
  media_url?: string | null;
  media_disk_path?: string | null;
  media_mime?: string | null;
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
  availability?: "available" | "upcoming" | "expired";
  attested_at?: string | null;
  attestation_pending?: boolean;
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
  availability?: Enrollment["availability"];
};

type LearnPayload = {
  data: Enrollment[];
};

/** "My courses" on the employee dashboard: assigned awareness training, lessons, quizzes and attestation. */
export function MyCoursesSection() {
  const t = useTranslations("learn");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const courseParam = searchParams.get("course");
  const enrollmentParam = searchParams.get("enrollment");
  const targetParam = searchParams.get("target");
  const tenantParam = searchParams.get("tenant");
  const tenant = resolveTenant(tenantParam);

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
  const [loading, setLoading] = useState(true);
  const [submittingQuizId, setSubmittingQuizId] = useState<number | null>(null);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [attesting, setAttesting] = useState(false);
  const lastHeartbeat = useRef<Record<number, number>>({});
  const channel =
    tenant && userId != null ? learnLiveChannel(tenant, userId) : null;

  const enrollmentRows = useMemo<EnrollmentRow[]>(
    () =>
      enrollments.map((row) => ({
        id: row.id,
        course: row.course?.title ?? t("courseFallback", { id: row.course_id }),
        status: row.status,
        progress: row.progress,
        availability: row.availability,
      })),
    [enrollments, t],
  );

  const active = useMemo(
    () =>
      enrollments.find((row) => row.id === activeEnrollmentId) ??
      enrollments[0] ??
      null,
    [enrollments, activeEnrollmentId],
  );
  const course = active?.course ?? null;
  const blockedNotice =
    active?.availability === "upcoming"
      ? t("upcomingNotice")
      : active?.availability === "expired"
        ? t("expiredNotice")
        : null;
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
        return;
      }
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
    try {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        toastWarning(t("signInRequired"));
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
      if (err instanceof ApiError && err.status === 403 && err.message === NO_ASSIGNED_TRAINING_MESSAGE) {
        applyEnrollmentList([]);
      } else if (err instanceof ApiError && err.status === 403) {
        toastError(err.message);
      } else {
        toastError(err instanceof Error ? err.message : t("loadFailed"));
      }
    }
  }, [applyEnrollmentList, courseParam, t, targetParam, tenant]);

  const { status, error: liveError } = useLiveTopic<LearnPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    void loadAssignments().finally(() => setLoading(false));
  }, [loadAssignments]);

  useEffect(() => {
    if (liveEnrollments !== null) {
      applyEnrollmentList(liveEnrollments);
      setLoading(false);
    }
  }, [liveEnrollments, applyEnrollmentList]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

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
      toastError(err instanceof Error ? err.message : t("progressFailed"));
    }
  }

  async function markComplete(lesson: Lesson) {
    await reportLessonProgress(lesson, { completed: true, progress_pct: 100 });
    toastInfo(t("markedComplete", { title: lesson.title }));
  }

  function onTimedMediaTime(lesson: Lesson, currentTime: number, duration: number) {
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
          toastWarning(t("essayRequired", { number: index + 1 }));
          return;
        }
        continue;
      }
      if (typeof answer !== "number" || answer < 0) {
        toastWarning(t("answerRequired", { number: index + 1 }));
        return;
      }
    }
    if (
      quiz.time_limit_seconds &&
      (remainingByQuiz[quiz.id] ?? quiz.time_limit_seconds) <= 0
    ) {
      toastWarning(t("timeLimitExceeded"));
      return;
    }

    setSubmittingQuizId(quiz.id);
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
      toastInfo(
        t("quizResult", {
          title: quiz.title,
          score: res.data.score,
          result: res.data.passed ? t("resultPassed") : t("resultRetry"),
        }),
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
      toastError(err instanceof Error ? err.message : t("quizFailed"));
    } finally {
      setSubmittingQuizId(null);
    }
  }

  async function acceptAttestation() {
    if (!active) return;
    setAttesting(true);
    try {
      await ensureCsrf();
      const res = await api<{ data: Enrollment }>("/api/v1/org/training/attestation", {
        method: "POST",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollment_id: active.id, accepted: true }),
      });
      setEnrollments((prev) =>
        prev.map((row) =>
          row.id === res.data.id ? { ...row, ...res.data, course: row.course } : row,
        ),
      );
      toastInfo(t("attestationAccepted"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("attestationFailed"));
    } finally {
      setAttesting(false);
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
    setAttestationChecked(false);
    setAnswersByQuiz({});
    setStartedAtByQuiz({});
    setRemainingByQuiz({});
    
  }

  function availabilityNote(availability: Enrollment["availability"]): string | null {
    if (availability === "upcoming") return t("availabilityUpcoming");
    if (availability === "expired") return t("availabilityExpired");
    return null;
  }

  const enrollmentColumns: Array<DataTableColumn<EnrollmentRow>> = [
    {
      id: "course",
      header: tCommon("course"),
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
                {t("current")}
              </span>
            ) : null}
          </span>
        </button>
      ),
    },
    {
      id: "status",
      header: tCommon("status"),
      accessorKey: "status",
      cell: (row) => {
        const note = availabilityNote(row.availability);
        return note ? `${row.status} · ${note}` : row.status;
      },
    },
    {
      id: "progress",
      header: tCommon("progress"),
      accessorKey: "progress",
      filterValue: (row) => row.progress,
      cell: (row) => `${row.progress}%`,
    },
  ];

  if (loading && enrollments.length === 0) {
    return <PageSkeleton className="px-0 py-0" />;
  }

  if (enrollments.length === 0) {
    return (
      <EmptyState
        title={t("noAssignedCourses")}
        description={t("noAssignedCoursesHint")}
      />
    );
  }

  const defaultDescription = t("defaultDescription");

  return (
    <div className="min-w-0">
      {course ? (
        <div className="mb-2">
          <h3 className="text-lg font-medium text-[var(--foreground)]">{course.title}</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            {statusLabel
              ? `${course.description ?? defaultDescription} · ${statusLabel}`
              : (course.description ?? defaultDescription)}
          </p>
        </div>
      ) : null}

      {enrollments.length > 1 ? (
        <DataTable
          className="mt-4"
          mode="client"
          caption={t("assignedCourses")}
          columns={enrollmentColumns}
          rows={enrollmentRows}
          getRowId={(row) => row.id}
          onRowClick={(row) => selectEnrollment(row.id)}
          emptyTitle={t("noAssignedCourses")}
          emptyFilteredTitle={t("noAssignedCourses")}
        />
      ) : null}

      {active ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          {tCommon("progress")} {active.progress}% · {tCommon("status")}{" "}
          {active.status}
        </p>
      ) : null}

      {blockedNotice ? (
        <Panel className="mt-6 p-5">
          <p className="text-sm text-[var(--muted-foreground)]">{blockedNotice}</p>
        </Panel>
      ) : null}

      {blockedNotice ? null : course?.lessons && course.lessons.length > 0 ? (
        course.lessons.map((lesson) => {
          const type = lesson.content_type ?? "text";
          const src = lessonMediaSrc(lesson, tenant);
          const embed =
            !lesson.media_disk_path && lesson.media_url
              ? lessonVideoEmbed(lesson.media_url)
              : null;
          const done = lessonDone(lesson.id);

          return (
            <Panel
              key={lesson.id}
              title={lesson.title}
              actions={
                <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {t(`lessonType.${type}`)}
                  {done ? ` · ${t("lessonCompleted")}` : ""}
                </span>
              }
              className="mt-6"
              contentClassName="space-y-3"
            >
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
                    onTimedMediaTime(
                      lesson,
                      el.currentTime,
                      el.duration || lesson.duration_seconds || 0,
                    );
                  }}
                />
              ) : null}

              {type === "audio" && src ? (
                <audio
                  className="w-full"
                  controls
                  src={src}
                  onPlay={() => {
                    void reportLessonProgress(lesson, { opened: true, progress_pct: 1 });
                  }}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    onTimedMediaTime(
                      lesson,
                      el.currentTime,
                      el.duration || lesson.duration_seconds || 0,
                    );
                  }}
                />
              ) : null}

              {isDocumentLesson(lesson) && src ? (
                documentKind(lesson) === "office" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {t("downloadDocumentHint")}
                    </p>
                    <a
                      href={src}
                      download
                      className="inline-flex text-sm font-medium underline"
                      onClick={() => {
                        void reportLessonProgress(lesson, {
                          opened: true,
                          progress_pct: 1,
                        });
                      }}
                    >
                      {t("downloadDocument")}
                    </a>
                  </div>
                ) : (
                  <iframe
                    title={lesson.title}
                    src={src}
                    className="h-[60svh] min-h-72 w-full rounded-[var(--radius)] border border-[var(--border)] sm:h-[28rem]"
                    onLoad={() => {
                      void reportLessonProgress(lesson, {
                        opened: true,
                        progress_pct: 1,
                      });
                    }}
                  />
                )
              ) : null}

              {(type === "text" ||
                isDocumentLesson(lesson) ||
                (type === "video" && embed)) &&
              !done ? (
                <Button type="button" variant="secondary" onClick={() => void markComplete(lesson)}>
                  {t("markComplete")}
                </Button>
              ) : null}
            </Panel>
          );
        })
      ) : (
        <EmptyState
          className="mt-6"
          title={t("noLessons")}
          description={t("noLessonsDescription")}
        />
      )}

      {(blockedNotice ? [] : courseQuizzes).map((quiz) => {
        const answers = answersByQuiz[quiz.id] ?? [];
        const remaining = remainingByQuiz[quiz.id];
        const started = Boolean(startedAtByQuiz[quiz.id]);
        const quizMeta = [
          t("passScore", { score: quiz.pass_score }),
          quiz.is_required === false ? tCommon("optional") : t("required"),
          quiz.time_limit_seconds
            ? t("timeLimitLabel", { seconds: quiz.time_limit_seconds })
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Panel
            key={quiz.id}
            title={quiz.title}
            actions={
              quiz.time_limit_seconds ? (
                <span className="text-sm text-[var(--muted-foreground)]">
                  {started
                    ? t("timeLeft", {
                        seconds: remaining ?? quiz.time_limit_seconds,
                      })
                    : t("timerStartsHint")}
                </span>
              ) : null
            }
            className="mt-6"
            contentClassName="space-y-5"
          >
            <p className="text-xs text-[var(--muted-foreground)]">{quizMeta}</p>
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
                        {t("essayNotScored")}
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
              {submittingQuizId === quiz.id
                ? tCommon("submitting")
                : t("submitQuiz")}
            </Button>
          </Panel>
        );
      })}

      {!blockedNotice && active?.attestation_pending ? (
        <Panel
          title={t("attestationTitle")}
          className="mt-6"
          contentClassName="space-y-4"
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("attestationHint")}
          </p>
          <p className="text-sm">{t("attestationText")}</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--primary)]"
              checked={attestationChecked}
              onChange={(e) => setAttestationChecked(e.target.checked)}
            />
            <span>{t("attestationCheckbox")}</span>
          </label>
          <Button
            type="button"
            onClick={() => void acceptAttestation()}
            disabled={!attestationChecked || attesting}
          >
            {attesting ? tCommon("submitting") : t("attestationSubmit")}
          </Button>
        </Panel>
      ) : null}

      {!blockedNotice && active?.attested_at ? (
        <Panel className="mt-6 p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("attestationAcceptedOn", {
              date: new Date(active.attested_at).toLocaleString(),
            })}
          </p>
        </Panel>
      ) : null}
</div>
  );
}
