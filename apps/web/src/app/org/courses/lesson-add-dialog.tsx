"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import { emptyLessonForm } from "../training/training-shared";
import {
  lessonRequestBody,
  postLesson,
  uploadLessonFile,
} from "./course-api";
import { LessonContentFields } from "./lesson-content-fields";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  onAdded: () => Promise<void>;
};

export function LessonAddDialog({ open, onOpenChange, courseId, onAdded }: Props) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");
  const formId = useId();
  const [form, setForm] = useState(emptyLessonForm);
  const [upload, setUpload] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function addLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      toastWarning(t("lessonTitleRequired"));
      return;
    }
    setSaving(true);
    try {
      await ensureCsrf();
      const media = await uploadLessonFile(form, upload);
      await postLesson(courseId, lessonRequestBody(form, media));
      setForm(emptyLessonForm);
      setUpload(null);
      toastSuccess(t("lessonAdded"));
      onOpenChange(false);
      await onAdded();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("lessonCreateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("addLesson")}
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
            {saving ? tCommon("creating") : t("addLesson")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void addLesson(event)}>
        <LessonContentFields
          idPrefix="lesson"
          values={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onFileChange={setUpload}
        />
      </form>
    </Dialog>
  );
}
