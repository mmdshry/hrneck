"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  isTimedMediaLesson,
  isUploadableContentType,
  mediaAcceptForContentType,
  type Lesson,
} from "../training/training-shared";
import type { LessonFormValues } from "./course-api";

type Props = {
  /** Prefix for input ids so each dialog keeps unique, stable ids. */
  idPrefix: string;
  values: LessonFormValues;
  onChange: (patch: Partial<LessonFormValues>) => void;
  onFileChange: (file: File | null) => void;
  /** Rendered between the title/type row and the content fields. */
  children?: ReactNode;
};

export function LessonContentFields({
  idPrefix,
  values,
  onChange,
  onFileChange,
  children,
}: Props) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-title`}>{tCommon("titleLabel")}</Label>
          <Input
            id={`${idPrefix}-title`}
            value={values.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={t("lessonTitlePlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-type`}>{tCommon("type")}</Label>
          <Select
            id={`${idPrefix}-type`}
            value={values.content_type}
            onChange={(e) =>
              onChange({ content_type: e.target.value as Lesson["content_type"] })
            }
          >
            <option value="text">{t("textArticle")}</option>
            <option value="video">{t("video")}</option>
            <option value="audio">{t("audio")}</option>
            <option value="document">{t("document")}</option>
          </Select>
        </div>
      </div>
      {children}
      {values.content_type === "text" ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-body`}>{tCommon("body")}</Label>
          <Textarea
            id={`${idPrefix}-body`}
            rows={4}
            value={values.body}
            onChange={(e) => onChange({ body: e.target.value })}
          />
        </div>
      ) : null}
      {values.content_type === "video" ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-url`}>{t("youtubeVimeoUrl")}</Label>
          <Input
            id={`${idPrefix}-url`}
            value={values.media_url}
            onChange={(e) => onChange({ media_url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </div>
      ) : null}
      {isTimedMediaLesson(values) ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-duration`}>{t("durationSeconds")}</Label>
          <Input
            id={`${idPrefix}-duration`}
            type="number"
            min={0}
            value={values.duration_seconds}
            onChange={(e) => onChange({ duration_seconds: e.target.value })}
          />
        </div>
      ) : null}
      {isUploadableContentType(values.content_type) ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-file`}>
            {values.content_type === "document"
              ? t("uploadDocument")
              : values.content_type === "audio"
                ? t("uploadAudio")
                : t("uploadVideo")}
          </Label>
          <Input
            id={`${idPrefix}-file`}
            type="file"
            accept={mediaAcceptForContentType(values.content_type)}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : null}
    </div>
  );
}
