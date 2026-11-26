import { api } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import {
  isTimedMediaLesson,
  isUploadableContentType,
  uploadTrainingMedia,
  type Course,
  type Lesson,
} from "../training/training-shared";

export type LessonFormValues = {
  title: string;
  content_type: Lesson["content_type"];
  body: string;
  media_url: string;
  duration_seconds: string;
};

export type LessonMediaMeta = {
  media_disk_path?: string;
  media_mime?: string;
  media_size?: number;
};

export type CourseCreatePayload = {
  title: string;
  description: string | null;
  duration_minutes: number;
  is_sample: false;
};

export type LessonRequestBody = ReturnType<typeof lessonRequestBody>;

export function lessonRequestBody(values: LessonFormValues, media: LessonMediaMeta) {
  return {
    title: values.title.trim(),
    content_type: values.content_type,
    body: values.content_type === "text" ? values.body : "",
    media_url:
      values.content_type === "video" && !media.media_disk_path
        ? values.media_url.trim() || null
        : null,
    media_disk_path: media.media_disk_path ?? null,
    media_mime: media.media_mime ?? null,
    media_size: media.media_size ?? null,
    duration_seconds:
      isTimedMediaLesson(values) && values.duration_seconds
        ? Number(values.duration_seconds)
        : null,
  };
}

export async function uploadLessonFile(
  values: LessonFormValues,
  file: File | null,
): Promise<LessonMediaMeta> {
  if (file && isUploadableContentType(values.content_type)) {
    return uploadTrainingMedia(file, values.content_type);
  }
  return {};
}

export async function postCourse(payload: CourseCreatePayload): Promise<Course> {
  const res = await api<{ data: Course }>("/api/v1/org/training/courses", {
    method: "POST",
    tenant: resolveTenant(),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function postLesson(courseId: number, body: LessonRequestBody): Promise<void> {
  await api(`/api/v1/org/training/courses/${courseId}/lessons`, {
    method: "POST",
    tenant: resolveTenant(),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
