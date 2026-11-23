import { api } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";

export type LessonContentType = "text" | "video" | "audio" | "document" | "pdf";

export type Lesson = {
  id: number;
  title: string;
  content_type: LessonContentType;
  body?: string | null;
  media_url?: string | null;
  media_disk_path?: string | null;
  media_mime?: string | null;
  duration_seconds?: number | null;
  sort_order: number;
};

export type UploadableContentType = "video" | "audio" | "document";

export type QuizQuestionType = "mcq" | "essay";

export type QuizQuestion = {
  id?: number;
  type: QuizQuestionType;
  prompt: string;
  options?: string[] | null;
  correct_index?: number | null;
};

export type CourseQuiz = {
  id: number;
  title: string;
  pass_score: number;
  is_required: boolean;
  time_limit_seconds?: number | null;
  sort_order?: number;
  questions: QuizQuestion[];
};

export type Course = {
  id: number;
  title: string;
  description?: string | null;
  duration_minutes: number;
  lessons?: Lesson[];
  quizzes?: CourseQuiz[];
  /** @deprecated Prefer quizzes[] */
  quiz?: CourseQuiz | null;
};

export type QuizDraftQuestion = {
  type: QuizQuestionType;
  prompt: string;
  options_text: string;
  correct_index: string;
};

export type QuizDraft = {
  title: string;
  pass_score: string;
  is_required: boolean;
  time_limit_seconds: string;
  questions: QuizDraftQuestion[];
};

export const emptyQuizQuestionDraft = (): QuizDraftQuestion => ({
  type: "mcq",
  prompt: "",
  options_text: "",
  correct_index: "0",
});

export const emptyQuizDraft = (): QuizDraft => ({
  title: "",
  pass_score: "70",
  is_required: true,
  time_limit_seconds: "",
  questions: [emptyQuizQuestionDraft()],
});

export function quizToDraft(quiz: CourseQuiz): QuizDraft {
  return {
    title: quiz.title,
    pass_score: String(quiz.pass_score ?? 70),
    is_required: quiz.is_required !== false,
    time_limit_seconds:
      quiz.time_limit_seconds != null ? String(quiz.time_limit_seconds) : "",
    questions:
      quiz.questions.length > 0
        ? quiz.questions.map((question) => ({
            type: question.type === "essay" ? "essay" : "mcq",
            prompt: question.prompt,
            options_text: (question.options ?? []).join("\n"),
            correct_index: String(question.correct_index ?? 0),
          }))
        : [emptyQuizQuestionDraft()],
  };
}

export function draftToQuizPayload(draft: QuizDraft): {
  title: string;
  pass_score: number;
  is_required: boolean;
  time_limit_seconds: number | null;
  questions: {
    type: QuizQuestionType;
    prompt: string;
    options?: string[];
    correct_index?: number;
  }[];
} {
  return {
    title: draft.title.trim(),
    pass_score: Number(draft.pass_score) || 70,
    is_required: draft.is_required,
    time_limit_seconds: draft.time_limit_seconds.trim()
      ? Number(draft.time_limit_seconds)
      : null,
    questions: draft.questions.map((question) => {
      if (question.type === "essay") {
        return {
          type: "essay" as const,
          prompt: question.prompt.trim(),
        };
      }
      const options = question.options_text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return {
        type: "mcq" as const,
        prompt: question.prompt.trim(),
        options,
        correct_index: Number(question.correct_index) || 0,
      };
    }),
  };
}

export type LessonProgressRow = {
  lesson_id: number;
  status: string;
  progress_pct: number;
  watched_seconds?: number;
  opened_at?: string | null;
  completed_at?: string | null;
};

export type EnrollmentRow = {
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

export const emptyLessonForm = {
  title: "",
  content_type: "text" as Lesson["content_type"],
  body: "",
  media_url: "",
  duration_seconds: "",
};

export const emptyQuickContentForm = {
  title: "",
  content_type: "text" as Lesson["content_type"],
  body: "",
  media_url: "",
  duration_seconds: "",
  description: "",
  duration_minutes: "8",
};

export function formatTs(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function isUploadableContentType(
  type: Lesson["content_type"],
): type is UploadableContentType {
  return type === "video" || type === "audio" || type === "document";
}

export function isDocumentLesson(lesson: {
  content_type?: LessonContentType | null;
}): boolean {
  return lesson.content_type === "document" || lesson.content_type === "pdf";
}

export function isTimedMediaLesson(lesson: {
  content_type?: LessonContentType | null;
}): boolean {
  return lesson.content_type === "video" || lesson.content_type === "audio";
}

export function mediaAcceptForContentType(
  contentType: UploadableContentType,
): string {
  switch (contentType) {
    case "video":
      return "video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv";
    case "audio":
      return "audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg";
    case "document":
      return ".pdf,.txt,.md,.doc,.docx,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default: {
      const _exhaustive: never = contentType;
      return _exhaustive;
    }
  }
}

export function documentKind(
  lesson: Pick<Lesson, "media_mime" | "media_disk_path" | "media_url">,
): "pdf" | "text" | "office" | "unknown" {
  const mime = (lesson.media_mime ?? "").toLowerCase();
  const path = (
    lesson.media_disk_path ??
    lesson.media_url ??
    ""
  ).toLowerCase();

  if (
    mime === "application/pdf" ||
    path.endsWith(".pdf") ||
    path.includes(".pdf.")
  ) {
    return "pdf";
  }
  if (
    mime.startsWith("text/") ||
    path.endsWith(".txt") ||
    path.endsWith(".md")
  ) {
    return "text";
  }
  if (
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    path.endsWith(".doc") ||
    path.endsWith(".docx")
  ) {
    return "office";
  }
  return "unknown";
}

export async function uploadTrainingMedia(
  file: File,
  contentType: UploadableContentType,
): Promise<{
  media_disk_path: string;
  media_mime: string;
  media_size: number;
  content_type: UploadableContentType;
}> {
  const form = new FormData();
  form.append("file", file);
  form.append("content_type", contentType);
  const uploaded = await api<{
    data: {
      media_disk_path: string;
      media_mime: string;
      media_size: number;
      content_type: UploadableContentType;
    };
  }>("/api/v1/org/training/media/upload", {
    method: "POST",
    tenant: resolveTenant(),
    body: form,
  });
  return uploaded.data;
}

export function lessonVideoEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Stream URL for uploaded lesson media, or embed/external URL when present. */
export function lessonMediaSrc(
  lesson: Pick<Lesson, "id" | "media_disk_path" | "media_url">,
  tenant: string,
): string | null {
  if (lesson.media_disk_path) {
    return `/api/v1/org/training/media/${lesson.id}?tenant=${encodeURIComponent(tenant)}`;
  }
  if (lesson.media_url) {
    return lessonVideoEmbed(lesson.media_url) || lesson.media_url;
  }
  return null;
}

export function lessonHasPreviewableMedia(
  lesson: Pick<Lesson, "media_disk_path" | "media_url">,
): boolean {
  return Boolean(lesson.media_disk_path || lesson.media_url);
}
