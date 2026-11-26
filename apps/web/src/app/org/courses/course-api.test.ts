import { describe, expect, it } from "vitest";
import { lessonRequestBody, type LessonFormValues } from "./course-api";

const textLesson: LessonFormValues = {
  title: "  Password hygiene  ",
  content_type: "text",
  body: "Use a manager.",
  media_url: "",
  duration_seconds: "",
};

describe("lessonRequestBody", () => {
  it("trims the title and keeps the body only for text lessons", () => {
    expect(lessonRequestBody(textLesson, {})).toMatchObject({
      title: "Password hygiene",
      body: "Use a manager.",
    });
    expect(
      lessonRequestBody({ ...textLesson, content_type: "document", body: "ignored" }, {}).body,
    ).toBe("");
  });

  it("sends the external video URL only when no upload is attached", () => {
    const video: LessonFormValues = {
      ...textLesson,
      content_type: "video",
      media_url: "  https://youtu.be/abc  ",
    };
    expect(lessonRequestBody(video, {}).media_url).toBe("https://youtu.be/abc");
    expect(lessonRequestBody(video, { media_disk_path: "lessons/a.mp4" }).media_url).toBeNull();
  });

  it("converts duration only for timed media", () => {
    const audio: LessonFormValues = { ...textLesson, content_type: "audio", duration_seconds: "90" };
    expect(lessonRequestBody(audio, {}).duration_seconds).toBe(90);
    expect(
      lessonRequestBody({ ...textLesson, content_type: "text", duration_seconds: "90" }, {})
        .duration_seconds,
    ).toBeNull();
    expect(lessonRequestBody({ ...audio, duration_seconds: "" }, {}).duration_seconds).toBeNull();
  });

  it("passes uploaded media metadata through and defaults missing values to null", () => {
    expect(
      lessonRequestBody(
        { ...textLesson, content_type: "document" },
        { media_disk_path: "lessons/a.pdf", media_mime: "application/pdf", media_size: 2048 },
      ),
    ).toMatchObject({
      media_disk_path: "lessons/a.pdf",
      media_mime: "application/pdf",
      media_size: 2048,
    });
    expect(lessonRequestBody(textLesson, {})).toMatchObject({
      media_disk_path: null,
      media_mime: null,
      media_size: null,
    });
  });
});
