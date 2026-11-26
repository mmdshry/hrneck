"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import type { Course } from "../training/training-shared";
import { postCourse } from "./course-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (course: Course) => Promise<void>;
};

export function CourseCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");
  const formId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("8");
  const [saving, setSaving] = useState(false);

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      toastWarning(t("courseTitleRequired"));
      return;
    }
    setSaving(true);
    try {
      await ensureCsrf();
      const course = await postCourse({
        title: title.trim(),
        description: description.trim() || null,
        duration_minutes: Number(duration) || 8,
        is_sample: false,
      });
      setTitle("");
      setDescription("");
      setDuration("8");
      toastSuccess(t("courseCreated", { title: course.title }));
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
      title={t("newCourse")}
      size="md"
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
            {saving ? tCommon("creating") : t("createCourse")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-3"
        onSubmit={(event) => void createCourse(event)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="course-title">{tCommon("titleLabel")}</Label>
            <Input
              id="course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="course-duration">{t("durationMinutes")}</Label>
            <Input
              id="course-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="course-description">{tCommon("descriptionLabel")}</Label>
          <Textarea
            id="course-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </form>
    </Dialog>
  );
}
