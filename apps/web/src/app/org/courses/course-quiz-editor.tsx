"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastSuccess } from "@/lib/toast";
import {
  draftToQuizPayload,
  emptyQuizDraft,
  emptyQuizQuestionDraft,
  quizToDraft,
  type CourseQuiz,
  type QuizDraft,
} from "../training/training-shared";

type Props = {
  courseId: number;
  quizzes: CourseQuiz[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  onChanged: () => Promise<void>;
};

export function CourseQuizEditor({
  courseId,
  quizzes,
  busy,
  setBusy,
  setError,
  onChanged,
}: Props) {
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<QuizDraft>(emptyQuizDraft());

  function startCreate() {
    setEditingId("new");
    setDraft(emptyQuizDraft());
  }

  function startEdit(quiz: CourseQuiz) {
    setEditingId(quiz.id);
    setDraft(quizToDraft(quiz));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyQuizDraft());
  }

  async function saveQuiz() {
    const payload = draftToQuizPayload(draft);
    if (!payload.title) {
      setError("Quiz title is required.");
      return;
    }
    if (payload.questions.length === 0) {
      setError("Add at least one question.");
      return;
    }
    for (const [index, question] of payload.questions.entries()) {
      if (!question.prompt) {
        setError(`Question ${index + 1} needs a prompt.`);
        return;
      }
      if (
        question.type === "mcq" &&
        (!question.options || question.options.length < 2)
      ) {
        setError(`Question ${index + 1} needs at least two options (one per line).`);
        return;
      }
    }

    setBusy(true);
    setError(null);
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
        toastSuccess("Quiz created.");
      } else if (typeof editingId === "number") {
        await api(`/api/v1/org/training/courses/${courseId}/quizzes/${editingId}`, {
          method: "PUT",
          tenant,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess("Quiz saved.");
      }
      cancelEdit();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quiz");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuiz(quizId: number) {
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/training/courses/${courseId}/quizzes/${quizId}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess("Quiz deleted.");
      if (editingId === quizId) {
        cancelEdit();
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete quiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Quizzes</h3>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || editingId !== null}
          onClick={startCreate}
        >
          Add quiz
        </Button>
      </div>

      {quizzes.length === 0 && editingId === null ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No quizzes yet. Add an optional exam with multiple-choice and essay
          questions.
        </p>
      ) : null}

      <ul className="space-y-2">
        {quizzes.map((quiz) => (
          <li
            key={quiz.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{quiz.title}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Pass {quiz.pass_score}%
                {quiz.is_required ? " · required" : " · optional"}
                {quiz.time_limit_seconds
                  ? ` · ${quiz.time_limit_seconds}s limit`
                  : ""}
                {` · ${quiz.questions.length} question${quiz.questions.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || editingId !== null}
                onClick={() => startEdit(quiz)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void deleteQuiz(quiz.id)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editingId !== null ? (
        <div className="space-y-3 rounded-[var(--radius)] border border-[var(--border)] p-4">
          <h4 className="text-sm font-medium">
            {editingId === "new" ? "New quiz" : "Edit quiz"}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="quiz-title">Title</Label>
              <Input
                id="quiz-title"
                value={draft.title}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quiz-pass">Pass score (%)</Label>
              <Input
                id="quiz-pass"
                type="number"
                min={1}
                max={100}
                value={draft.pass_score}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, pass_score: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quiz-time">Time limit (seconds, optional)</Label>
              <Input
                id="quiz-time"
                type="number"
                min={30}
                value={draft.time_limit_seconds}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    time_limit_seconds: e.target.value,
                  }))
                }
                placeholder="No limit"
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.is_required}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    is_required: e.target.checked,
                  }))
                }
              />
              Required to complete the course
            </label>
          </div>

          <div className="space-y-3">
            {draft.questions.map((question, index) => (
              <div
                key={index}
                className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Question {index + 1}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-0 px-2 py-1 text-xs"
                    disabled={draft.questions.length <= 1}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        questions: prev.questions.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`q-type-${index}`}>Type</Label>
                    <Select
                      id={`q-type-${index}`}
                      value={question.type}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          questions: prev.questions.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  type: e.target.value as "mcq" | "essay",
                                }
                              : row,
                          ),
                        }))
                      }
                    >
                      <option value="mcq">Multiple choice</option>
                      <option value="essay">Essay (no score)</option>
                    </Select>
                  </div>
                  {question.type === "mcq" ? (
                    <div className="space-y-1">
                      <Label htmlFor={`q-correct-${index}`}>
                        Correct option index (0-based)
                      </Label>
                      <Input
                        id={`q-correct-${index}`}
                        type="number"
                        min={0}
                        value={question.correct_index}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            questions: prev.questions.map((row, i) =>
                              i === index
                                ? { ...row, correct_index: e.target.value }
                                : row,
                            ),
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`q-prompt-${index}`}>Prompt</Label>
                  <Textarea
                    id={`q-prompt-${index}`}
                    rows={2}
                    value={question.prompt}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        questions: prev.questions.map((row, i) =>
                          i === index ? { ...row, prompt: e.target.value } : row,
                        ),
                      }))
                    }
                  />
                </div>
                {question.type === "mcq" ? (
                  <div className="space-y-1">
                    <Label htmlFor={`q-options-${index}`}>
                      Options (one per line)
                    </Label>
                    <Textarea
                      id={`q-options-${index}`}
                      rows={3}
                      value={question.options_text}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          questions: prev.questions.map((row, i) =>
                            i === index
                              ? { ...row, options_text: e.target.value }
                              : row,
                          ),
                        }))
                      }
                    />
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Essay answers are collected only and do not affect the pass
                    score.
                  </p>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  questions: [...prev.questions, emptyQuizQuestionDraft()],
                }))
              }
            >
              Add question
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void saveQuiz()}>
              {busy ? "Saving…" : "Save quiz"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
