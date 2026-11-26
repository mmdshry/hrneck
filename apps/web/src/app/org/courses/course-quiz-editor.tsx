"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import {
  draftToQuizPayload,
  emptyQuizDraft,
  quizToDraft,
  type CourseQuiz,
  type QuizDraft,
} from "../training/training-shared";
import {
  findQuizQuestionsIssue,
  findQuizSettingsIssue,
  isQuizDraftChanged,
  type QuizDraftIssue,
} from "./quiz-draft-rules";
import {
  QuizQuestionsStep,
  QuizReviewStep,
  QuizSettingsStep,
} from "./course-quiz-steps";

type Props = {
  courseId: number;
  quizzes: CourseQuiz[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  onChanged: () => Promise<void>;
};

export function CourseQuizEditor({
  courseId,
  quizzes,
  busy,
  setBusy,
  onChanged,
}: Props) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");
  const wizardLabels = useWizardLabels({ submit: t("saveQuiz") });
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<QuizDraft>(emptyQuizDraft());
  const [baseline, setBaseline] = useState<QuizDraft>(emptyQuizDraft());
  const [deleteTarget, setDeleteTarget] = useState<CourseQuiz | null>(null);
  const editing = editingId !== null;

  function startCreate() {
    const next = emptyQuizDraft();
    setEditingId("new");
    setBaseline(next);
    setDraft(next);
  }

  function startEdit(quiz: CourseQuiz) {
    const next = quizToDraft(quiz);
    setEditingId(quiz.id);
    setBaseline(next);
    setDraft(next);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function issueMessage(issue: QuizDraftIssue): string {
    switch (issue.kind) {
      case "titleRequired":
        return t("quizTitleRequired");
      case "noQuestions":
        return t("addAtLeastOneQuestion");
      case "promptRequired":
        return t("quizQuestionPromptRequired", { number: issue.questionNumber });
      case "optionsRequired":
        return t("quizQuestionOptionsRequired", { number: issue.questionNumber });
      default: {
        const exhaustive: never = issue;
        return exhaustive;
      }
    }
  }

  function acceptStep(issue: QuizDraftIssue | null): boolean {
    if (!issue) {
      return true;
    }
    toastWarning(issueMessage(issue));
    return false;
  }

  const steps: WizardStep[] = [
    {
      id: "settings",
      title: t("quizStepSettings"),
      description: t("quizStepSettingsHint"),
      validate: () => acceptStep(findQuizSettingsIssue(draft)),
      render: () => <QuizSettingsStep draft={draft} setDraft={setDraft} />,
    },
    {
      id: "questions",
      title: t("quizStepQuestions"),
      description: t("quizStepQuestionsHint"),
      validate: () => acceptStep(findQuizQuestionsIssue(draft)),
      render: () => <QuizQuestionsStep draft={draft} setDraft={setDraft} />,
    },
    {
      id: "review",
      title: t("quizStepReview"),
      description: t("quizStepReviewHint"),
      validate: () =>
        acceptStep(findQuizSettingsIssue(draft) ?? findQuizQuestionsIssue(draft)),
      render: () => <QuizReviewStep draft={draft} />,
    },
  ];

  function quizSummary(quiz: CourseQuiz): string {
    const parts = [
      t("quizPassSummary", { score: quiz.pass_score }),
      quiz.is_required ? t("quizRequiredValue") : t("quizOptionalValue"),
    ];
    if (quiz.time_limit_seconds) {
      parts.push(t("quizTimeLimitSeconds", { seconds: quiz.time_limit_seconds }));
    }
    parts.push(t("quizQuestionCount", { count: quiz.questions.length }));
    return parts.join(" · ");
  }

  async function saveQuiz() {
    const payload = draftToQuizPayload(draft);
    setBusy(true);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      if (editingId === "new") {
        await api(`/api/v1/org/training/courses/${courseId}/quizzes`, {
          method: "POST",
          tenant,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("quizCreated"));
      } else if (typeof editingId === "number") {
        await api(`/api/v1/org/training/courses/${courseId}/quizzes/${editingId}`, {
          method: "PUT",
          tenant,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("quizSaved"));
      }
      cancelEdit();
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("quizSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuiz(quizId: number) {
    setBusy(true);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/training/courses/${courseId}/quizzes/${quizId}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess(t("quizDeleted"));
      if (editingId === quizId) {
        cancelEdit();
      }
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("quizDeleteFailed"));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t("quizzes")}</h3>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || editing}
          onClick={startCreate}
        >
          {t("addQuiz")}
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">{t("noQuizzes")}</p>
      ) : null}

      <ul className="space-y-2">
        {quizzes.map((quiz) => (
          <li
            key={quiz.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{quiz.title}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{quizSummary(quiz)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || editing}
                onClick={() => startEdit(quiz)}
              >
                {tCommon("edit")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDeleteTarget(quiz)}
              >
                {tCommon("delete")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <WizardDialog
        open={editing}
        onOpenChange={(open) => {
          if (!open) cancelEdit();
        }}
        title={editingId === "new" ? t("newQuiz") : t("editQuiz")}
        steps={steps}
        onSubmit={saveQuiz}
        labels={wizardLabels}
        size="xl"
        busy={busy}
        isDirty={editing && isQuizDraftChanged(draft, baseline)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("deleteQuiz")}
        description={t("deleteQuizConfirm", { title: deleteTarget?.title ?? "" })}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        workingLabel={tCommon("working")}
        errorFallback={t("quizDeleteFailed")}
        variant="destructive"
        loading={busy}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteQuiz(deleteTarget.id);
          }
        }}
      />
    </div>
  );
}
