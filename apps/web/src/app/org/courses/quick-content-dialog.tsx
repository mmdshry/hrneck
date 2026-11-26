"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import { emptyQuickContentForm, type Course } from "../training/training-shared";
import {
  lessonRequestBody,
  postCourse,
  postLesson,
  uploadLessonFile,
} from "./course-api";
import { LessonContentFields } from "./lesson-content-fields";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (course: Course) => Promise<void>;
};

export function QuickContentDialog({ open, onOpenChange, onCreated }: Props) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");
  const formId = useId();
  const [form, setForm] = useState(emptyQuickContentForm);
  const [upload, setUpload] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function createQuickContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      toastWarning(t("contentTitleRequired"));
      return;
    }
    setSaving(true);
    try {
      await ensureCsrf();
      const media = await uploadLessonFile(form, upload);
      const course = await postCourse({
        title: form.title.trim(),
        description: form.description.trim() || null,
        duration_minutes: Number(form.duration_minutes) || 8,
        is_sample: false,
      });
      await postLesson(course.id, lessonRequestBody(form, media));
      setForm(emptyQuickContentForm);
      setUpload(null);
      toastSuccess(t("quickContentCreated", { title: course.title }));
      onOpenChange(false);
      await onCreated(course);
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("newArticleVideo")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? tCommon("creating") : t("createContent")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void createQuickContent(event)}>
        <LessonContentFields
          idPrefix="quick"
          values={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onFileChange={setUpload}
        >
          <div className="space-y-1">
            <Label htmlFor="quick-description">{t("descriptionOptional")}</Label>
            <Input
              id="quick-description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>
        </LessonContentFields>
      </form>
    </Dialog>
  );
}
