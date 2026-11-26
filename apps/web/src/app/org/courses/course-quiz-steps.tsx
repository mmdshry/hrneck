"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  draftToQuizPayload,
  emptyQuizQuestionDraft,
  type QuizDraft,
  type QuizDraftQuestion,
} from "../training/training-shared";

type DraftStepProps = {
  draft: QuizDraft;
  setDraft: Dispatch<SetStateAction<QuizDraft>>;
};

export function QuizSettingsStep({ draft, setDraft }: DraftStepProps) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="quiz-title">{tCommon("titleLabel")}</Label>
        <Input
          id="quiz-title"
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quiz-pass">{t("quizPassScoreLabel")}</Label>
        <Input
          id="quiz-pass"
          type="number"
          min={1}
          max={100}
          value={draft.pass_score}
          onChange={(e) => setDraft((prev) => ({ ...prev, pass_score: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quiz-time">{t("quizTimeLimitLabel")}</Label>
        <Input
          id="quiz-time"
          type="number"
          min={30}
          value={draft.time_limit_seconds}
          placeholder={tCommon("noLimit")}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, time_limit_seconds: e.target.value }))
          }
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={draft.is_required}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, is_required: e.target.checked }))
          }
        />
        {t("quizRequiredLabel")}
      </label>
    </div>
  );
}

export function QuizQuestionsStep({ draft, setDraft }: DraftStepProps) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");

  function updateQuestion(index: number, patch: Partial<QuizDraftQuestion>) {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function removeQuestion(index: number) {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  }

  function addQuestion() {
    setDraft((prev) => ({
      ...prev,
      questions: [...prev.questions, emptyQuizQuestionDraft()],
    }));
  }

  return (
    <div className="space-y-3">
      {draft.questions.map((question, index) => (
        <div
          key={index}
          className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t("quizQuestionNumber", { number: index + 1 })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="compact"
              disabled={draft.questions.length <= 1}
              onClick={() => removeQuestion(index)}
            >
              {tCommon("remove")}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`q-type-${index}`}>{tCommon("type")}</Label>
              <Select
                id={`q-type-${index}`}
                value={question.type}
                onChange={(e) =>
                  updateQuestion(index, {
                    type: e.target.value as QuizDraftQuestion["type"],
                  })
                }
              >
                <option value="mcq">{t("quizTypeMultipleChoice")}</option>
                <option value="essay">{t("quizTypeEssay")}</option>
              </Select>
            </div>
            {question.type === "mcq" ? (
              <div className="space-y-1">
                <Label htmlFor={`q-correct-${index}`}>{t("quizCorrectIndexLabel")}</Label>
                <Input
                  id={`q-correct-${index}`}
                  type="number"
                  min={0}
                  value={question.correct_index}
                  onChange={(e) => updateQuestion(index, { correct_index: e.target.value })}
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`q-prompt-${index}`}>{t("quizPromptLabel")}</Label>
            <Textarea
              id={`q-prompt-${index}`}
              rows={2}
              value={question.prompt}
              onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
            />
          </div>
          {question.type === "mcq" ? (
            <div className="space-y-1">
              <Label htmlFor={`q-options-${index}`}>{t("quizOptionsLabel")}</Label>
              <Textarea
                id={`q-options-${index}`}
                rows={3}
                value={question.options_text}
                onChange={(e) => updateQuestion(index, { options_text: e.target.value })}
              />
            </div>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">{t("quizEssayNote")}</p>
          )}
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addQuestion}>
        {t("addQuestion")}
      </Button>
    </div>
  );
}

export function QuizReviewStep({ draft }: { draft: QuizDraft }) {
  const t = useTranslations("org.courses");
  const tCommon = useTranslations("common");
  const payload = draftToQuizPayload(draft);

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <SummaryItem label={tCommon("titleLabel")} value={payload.title} />
        <SummaryItem label={t("quizSummaryPassScore")} value={`${payload.pass_score}%`} />
        <SummaryItem
          label={t("quizSummaryTimeLimit")}
          value={
            payload.time_limit_seconds
              ? t("quizTimeLimitSeconds", { seconds: payload.time_limit_seconds })
              : tCommon("noLimit")
          }
        />
        <SummaryItem
          label={t("quizSummaryCompletion")}
          value={payload.is_required ? t("quizRequiredValue") : t("quizOptionalValue")}
        />
        <SummaryItem
          label={t("quizStepQuestions")}
          value={t("quizQuestionCount", { count: payload.questions.length })}
        />
      </dl>
      <ol className="space-y-2">
        {payload.questions.map((question, index) => (
          <li
            key={index}
            className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
          >
            <p className="text-xs font-medium text-[var(--muted-foreground)]">
              {t("quizQuestionNumber", { number: index + 1 })} ·{" "}
              {question.type === "essay" ? t("quizTypeEssay") : t("quizTypeMultipleChoice")}
            </p>
            <p className="break-words text-sm">{question.prompt}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--muted-foreground)]">{label}</dt>
      <dd className="break-words text-sm font-medium">{value}</dd>
    </div>
  );
}
